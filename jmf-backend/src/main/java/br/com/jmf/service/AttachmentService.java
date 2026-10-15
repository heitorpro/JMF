package br.com.jmf.service;

import br.com.jmf.common.ApiException;
import br.com.jmf.common.ErrorCode;
import br.com.jmf.common.TextSanitizer;
import br.com.jmf.config.JmfProperties;
import br.com.jmf.domain.model.Attachment;
import br.com.jmf.domain.repository.AttachmentRepository;
import br.com.jmf.security.CurrentUser;
import br.com.jmf.web.dto.Views;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Anexos (regra 10): limite de tamanho, tipo detectado pelos bytes iniciais (não pela extensão ou
 * Content-Type enviado), nome sanitizado e acesso privado (dono ou gestor).
 */
@Service
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    private final AttachmentRepository attachments;
    private final FileStorage storage;
    private final long maxBytes;
    private final Clock clock;

    public AttachmentService(AttachmentRepository attachments, FileStorage storage, JmfProperties props, Clock clock) {
        this.attachments = attachments;
        this.storage = storage;
        this.maxBytes = props.storage().maxBytes();
        this.clock = clock;
    }

    public record Download(Attachment attachment, InputStream content) {
    }

    @Transactional
    public Views.AttachmentView upload(CurrentUser user, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.field("file", "Selecione um arquivo.");
        }
        if (file.getSize() > maxBytes) {
            throw new ApiException(ErrorCode.PAYLOAD_TOO_LARGE);
        }
        LocalDate today = LocalDate.now(clock);
        String key = "%d/%02d/%s".formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID());
        try (InputStream raw = new BufferedInputStream(file.getInputStream())) {
            raw.mark(16);
            byte[] head = raw.readNBytes(12);
            raw.reset();
            String contentType = detectType(head);
            if (contentType == null) {
                throw ApiException.field("file", "Tipo de arquivo não permitido. Envie JPG, PNG, WEBP ou PDF.");
            }
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            try (DigestInputStream digest = new DigestInputStream(raw, sha)) {
                storage.store(key, digest);
            }
            Attachment saved = attachments.save(new Attachment(user.userId(),
                    TextSanitizer.fileName(file.getOriginalFilename()), key, contentType, file.getSize(),
                    HexFormat.of().formatHex(sha.digest())));
            return Mappers.attachment(saved);
        } catch (IOException | NoSuchAlgorithmException e) {
            log.error("Falha ao armazenar anexo: {}", e.getClass().getSimpleName());
            safeDelete(key);
            throw new ApiException(ErrorCode.INTERNAL_ERROR);
        } catch (RuntimeException e) {
            safeDelete(key);
            throw e;
        }
    }

    /** Anexo do próprio usuário, para vincular a uma solicitação. */
    @Transactional(readOnly = true)
    public Attachment requireOwned(UUID attachmentId, CurrentUser user) {
        return attachments.findByIdAndOwnerUserId(attachmentId, user.userId())
                .orElseThrow(() -> ApiException.field("attachmentId", "Anexo não encontrado."));
    }

    @Transactional(readOnly = true)
    public Download open(UUID attachmentId, CurrentUser user) {
        Attachment attachment = (user.isManager()
                ? attachments.findById(attachmentId)
                : attachments.findByIdAndOwnerUserId(attachmentId, user.userId()))
                .orElseThrow(ApiException::notFound);
        try {
            return new Download(attachment, storage.open(attachment.getStorageKey()));
        } catch (IOException e) {
            log.error("Anexo {} indisponível no armazenamento", attachment.getId());
            throw ApiException.notFound();
        }
    }

    static String detectType(byte[] h) {
        if (h.length >= 3 && (h[0] & 0xFF) == 0xFF && (h[1] & 0xFF) == 0xD8 && (h[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (h.length >= 8 && (h[0] & 0xFF) == 0x89 && h[1] == 'P' && h[2] == 'N' && h[3] == 'G'
                && h[4] == 0x0D && h[5] == 0x0A && h[6] == 0x1A && h[7] == 0x0A) {
            return "image/png";
        }
        if (h.length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') {
            return "image/webp";
        }
        if (h.length >= 5 && h[0] == '%' && h[1] == 'P' && h[2] == 'D' && h[3] == 'F' && h[4] == '-') {
            return "application/pdf";
        }
        return null;
    }

    private void safeDelete(String key) {
        try {
            storage.delete(key);
        } catch (IOException | RuntimeException ignored) {
            // melhor esforço
        }
    }
}

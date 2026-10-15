package br.com.jmf.web;

import br.com.jmf.service.AttachmentService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;

final class Downloads {

    private Downloads() {
    }

    /** Sempre "attachment" (nunca inline) e sem cache compartilhado. */
    static ResponseEntity<InputStreamResource> of(AttachmentService.Download download) {
        var a = download.attachment();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.getContentType()))
                .contentLength(a.getSizeBytes())
                .cacheControl(CacheControl.noStore().cachePrivate())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(a.getOriginalName(), StandardCharsets.UTF_8).build().toString())
                .body(new InputStreamResource(download.content()));
    }
}

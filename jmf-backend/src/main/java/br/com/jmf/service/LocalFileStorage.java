package br.com.jmf.service;

import br.com.jmf.config.JmfProperties;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Component
public class LocalFileStorage implements FileStorage {

    private final Path root;

    public LocalFileStorage(JmfProperties props) throws IOException {
        this.root = Path.of(props.storage().localDir()).toAbsolutePath().normalize();
        Files.createDirectories(root);
    }

    @Override
    public void store(String key, InputStream content) throws IOException {
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
    }

    @Override
    public InputStream open(String key) throws IOException {
        return Files.newInputStream(resolve(key));
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(resolve(key));
    }

    /** Impede path traversal: a chave é gerada pelo servidor, mas validamos mesmo assim. */
    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Chave de armazenamento inválida");
        }
        return path;
    }
}

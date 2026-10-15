package br.com.jmf.service;

import java.io.IOException;
import java.io.InputStream;

/**
 * Armazenamento privado de anexos. Implementação padrão em disco local ({@link LocalFileStorage});
 * para produção na Vercel/Neon, substitua por Vercel Blob (acesso privado) ou S3 compatível.
 */
public interface FileStorage {

    void store(String key, InputStream content) throws IOException;

    InputStream open(String key) throws IOException;

    void delete(String key) throws IOException;
}

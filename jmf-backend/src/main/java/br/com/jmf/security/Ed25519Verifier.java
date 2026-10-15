package br.com.jmf.security;

import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;

/**
 * Verificação Ed25519 usando apenas a JCA do Java 15+ (sem dependências extras).
 * O Neon Auth assina os JWTs com EdDSA/Ed25519 e publica as chaves como OKP no JWKS.
 */
public final class Ed25519Verifier {

    /** Prefixo DER SubjectPublicKeyInfo para chaves Ed25519 (OID 1.3.101.112). */
    private static final byte[] X509_PREFIX = {
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00
    };

    private Ed25519Verifier() {
    }

    public static PublicKey publicKey(byte[] rawX) throws GeneralSecurityException {
        if (rawX == null || rawX.length != 32) {
            throw new GeneralSecurityException("Chave Ed25519 deve ter 32 bytes");
        }
        byte[] encoded = new byte[X509_PREFIX.length + rawX.length];
        System.arraycopy(X509_PREFIX, 0, encoded, 0, X509_PREFIX.length);
        System.arraycopy(rawX, 0, encoded, X509_PREFIX.length, rawX.length);
        return KeyFactory.getInstance("Ed25519").generatePublic(new X509EncodedKeySpec(encoded));
    }

    public static boolean verify(byte[] rawPublicKey, byte[] signingInput, byte[] signature) {
        try {
            Signature verifier = Signature.getInstance("Ed25519");
            verifier.initVerify(publicKey(rawPublicKey));
            verifier.update(signingInput);
            return verifier.verify(signature);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return false;
        }
    }
}

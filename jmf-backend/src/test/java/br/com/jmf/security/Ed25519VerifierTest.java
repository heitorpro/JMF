package br.com.jmf.security;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Ed25519VerifierTest {

    @Test
    void verificaAssinaturaComChaveBrutaDoJwks() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
        byte[] encoded = pair.getPublic().getEncoded();          // X.509: 12 bytes de prefixo + 32 da chave
        byte[] rawX = Arrays.copyOfRange(encoded, encoded.length - 32, encoded.length);
        byte[] data = "header.payload".getBytes(StandardCharsets.US_ASCII);

        Signature signer = Signature.getInstance("Ed25519");
        signer.initSign(pair.getPrivate());
        signer.update(data);
        byte[] sig = signer.sign();

        assertTrue(Ed25519Verifier.verify(rawX, data, sig));
        assertFalse(Ed25519Verifier.verify(rawX, "header.adulterado".getBytes(StandardCharsets.US_ASCII), sig));
        assertFalse(Ed25519Verifier.verify(new byte[31], data, sig));
    }
}

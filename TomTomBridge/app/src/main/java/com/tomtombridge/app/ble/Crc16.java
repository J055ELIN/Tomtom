package com.tomtombridge.app.ble;

/**
 * CRC-16/MODBUS — l'algorithme utilisé par les montres TomTom pour valider
 * chaque bloc de transfert (source : CRCUtil.java décompilé de l'appli
 * officielle — poly 0x8005 réfléchi (0xA001), init 0xFFFF, sans XOR final).
 *
 * Vérification : CRC16("123456789") = 0x4B37.
 */
public final class Crc16 {

    private static final int POLY_REFLECTED = 0xA001;
    private static final int[] TABLE = new int[256];

    static {
        for (int i = 0; i < 256; i++) {
            int crc = i;
            for (int j = 0; j < 8; j++) {
                crc = ((crc & 1) != 0) ? ((crc >>> 1) ^ POLY_REFLECTED) : (crc >>> 1);
            }
            TABLE[i] = crc;
        }
    }

    private Crc16() {
    }

    /** CRC16/MODBUS sur data[offset .. offset+length-1]. */
    public static int crc16(byte[] data, int offset, int length) {
        int crc = 0xFFFF;
        for (int i = 0; i < length; i++) {
            crc = ((crc >>> 8) & 0xFFFF) ^ TABLE[(data[offset + i] ^ crc) & 0xFF];
        }
        return crc & 0xFFFF;
    }

    /** CRC16/MODBUS sur un tableau complet. */
    public static int crc16(byte[] data) {
        return crc16(data, 0, data.length);
    }

    /** CRC en 2 octets little-endian. */
    public static byte[] crc16Bytes(byte[] data, int offset, int length) {
        int crc = crc16(data, offset, length);
        return new byte[]{(byte) (crc & 0xFF), (byte) ((crc >> 8) & 0xFF)};
    }
}

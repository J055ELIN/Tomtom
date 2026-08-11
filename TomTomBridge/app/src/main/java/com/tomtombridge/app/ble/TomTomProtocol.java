package com.tomtombridge.app.ble;

import android.bluetooth.BluetoothGattCharacteristic;

import java.util.UUID;

/**
 * Protocole BLE des montres TomTom Sports.
 *
 * Valeurs extraites par rétro-ingénierie de l'application officielle
 * « TomTom Sports » (com.tomtom.Sports, v10.0.9) :
 *   - com.tomtom.ble.service.CommsSetupGattService
 *   - com.tomtom.ble.service.AbstractFileTransferGattService
 *   - com.tomtom.ble.device.FileTransferType
 *   - com.tomtom.ble.device.WatchDevice
 */
public final class TomTomProtocol {

    private TomTomProtocol() {
    }

    // ---------------------------------------------------------------
    // Services GATT
    // ---------------------------------------------------------------
    public static final UUID SERVICE_DEVICE_INFORMATION =
            UUID.fromString("0000180a-0000-1000-8000-00805f9b34fb");
    public static final UUID SERVICE_BATTERY =
            UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");
    /** Service de transfert de fichiers, génération 1 (anciennes montres). */
    public static final UUID SERVICE_FILE_TRANSFER_V1 =
            UUID.fromString("170d0d30-4213-11e3-aa6e-0800200c9a66");
    /** Service de transfert de fichiers, génération 2 (montres actuelles). */
    public static final UUID SERVICE_FILE_TRANSFER_V2 =
            UUID.fromString("b993bf90-81e1-11e4-b4a9-0800200c9a66");
    /** Service de mise en place des communications (appairage V2). */
    public static final UUID SERVICE_COMMS_SETUP =
            UUID.fromString("b993bf91-81e1-11e4-b4a9-0800200c9a66");

    // ---------------------------------------------------------------
    // Caractéristiques - File Transfer (V1 et V2)
    // ---------------------------------------------------------------
    public static final UUID CHAR_COMMAND =
            UUID.fromString("170d0d31-4213-11e3-aa6e-0800200c9a66");
    public static final UUID CHAR_TRANSFER_LENGTH =
            UUID.fromString("170d0d32-4213-11e3-aa6e-0800200c9a66");
    public static final UUID CHAR_TRANSFER_PACKET =
            UUID.fromString("170d0d33-4213-11e3-aa6e-0800200c9a66");
    public static final UUID CHAR_TRANSFER_BLOCK =
            UUID.fromString("170d0d34-4213-11e3-aa6e-0800200c9a66");

    // ---------------------------------------------------------------
    // Caractéristiques - Communications Setup (appairage V2)
    // ---------------------------------------------------------------
    public static final UUID CHAR_AUTH_TOKEN =
            UUID.fromString("b993bf92-81e1-11e4-b4a9-0800200c9a66");
    public static final UUID CHAR_APP_VERSION =
            UUID.fromString("b993bf93-81e1-11e4-b4a9-0800200c9a66");
    /** Canal « UIProd » : la montre pousse notifications / demandes de synchro. */
    public static final UUID CHAR_SYNC =
            UUID.fromString("47ec27b0-5c56-11e5-a837-0800200c9a66");
    public static final UUID CHAR_DEVICE_CAPABILITY =
            UUID.fromString("c6945cb0-4ab4-11e7-9598-0800200c9a66");

    // ---------------------------------------------------------------
    // Caractéristiques standards
    // ---------------------------------------------------------------
    public static final UUID CHAR_SYSTEM_ID =
            UUID.fromString("00002a23-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_MODEL_NUMBER =
            UUID.fromString("00002a24-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_SERIAL_NUMBER =
            UUID.fromString("00002a25-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_HARDWARE_REVISION =
            UUID.fromString("00002a27-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_SOFTWARE_REVISION =
            UUID.fromString("00002a28-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_MANUFACTURER_NAME =
            UUID.fromString("00002a29-0000-1000-8000-00805f9b34fb");
    public static final UUID CHAR_BATTERY_LEVEL =
            UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");
    public static final UUID CCCD =
            UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    // ---------------------------------------------------------------
    // Commandes (caractéristique COMMAND) - FileTransferCommand
    // ---------------------------------------------------------------
    public static final int CMD_SEND_TO_WATCH = 0;
    public static final int CMD_RECEIVE_FROM_WATCH = 1;
    public static final int CMD_CANCEL_CURRENT_TRANSFER = 2;
    public static final int CMD_LIST_FILES = 3;
    public static final int CMD_DELETE_FILE = 4;
    public static final int CMD_UPDATE_EPHEMERIS = 5;
    public static final int CMD_UPDATE_GOLF_MAPS = 6;
    public static final int CMD_RESET_DEVICE = 7;
    public static final int CMD_SET_TIME = 8;

    // ---------------------------------------------------------------
    // Types de fichiers (FileTransferType)
    // ---------------------------------------------------------------
    public static final int TYPE_EPHEMERIS = 1;
    public static final int TYPE_MANIFEST = 2;
    public static final int TYPE_REST_PROTO_FILE = 137;
    /** Entraînements - extension .ttbin */
    public static final int TYPE_WORKOUT = 145;
    /** Données de pas - extension .bucket */
    public static final int TYPE_STEP_BUCKET = 177;
    public static final int TYPE_GOLF_SCORECARDS = 148;
    public static final int TYPE_GOLF_MANIFEST = 176;
    public static final int TYPE_GOLF_ROUNDS = 148;
    /** Notifications téléphone -> montre */
    public static final int TYPE_NOTIFICATION = 181;
    public static final int TYPE_FIRMWARE_CHUNK = 253;
    /** Fichier « master name » (nom du téléphone) - enregistre le propriétaire de la montre. */
    public static final int TYPE_MASTER_NAME = 2;
    /** Préférences (compte MySports) - type 242 (0xF2). */
    public static final int TYPE_PREFERENCES = 242;
    /** Journaux de la montre - type 192 (0xC0). */
    public static final int TYPE_DEVICELOGS = 192;

    /** Numéros de fichiers internes (WatchDevice.FileTransferNumber). */
    public static final int NUM_MASTER_NAME = 2;
    public static final int NUM_PREFERENCES_FILE = 0;
    public static final int NUM_EVENTLOG = 2;
    public static final int NUM_DEVICE_INFORMATION = 1;

    // ---------------------------------------------------------------
    // Types d'écriture GATT utilisés par l'application officielle :
    //   - COMMAND / APP_VERSION / AUTH_TOKEN  -> WRITE_TYPE_SIGNED (2)
    //   - TRANSFER_LENGTH/PACKET/BLOCK        -> WRITE_TYPE_NO_RESPONSE (1)
    // ---------------------------------------------------------------
    public static final int WT_SIGNED = BluetoothGattCharacteristic.WRITE_TYPE_SIGNED;
    public static final int WT_NO_RESPONSE = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
    public static final int WT_DEFAULT = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;

    public static String fileTypeName(int type) {
        switch (type) {
            case TYPE_WORKOUT: return "WORKOUT (.ttbin)";
            case TYPE_STEP_BUCKET: return "STEP_BUCKET (.bucket)";
            case TYPE_EPHEMERIS: return "EPHEMERIS";
            case TYPE_MANIFEST: return "MANIFEST";
            case TYPE_REST_PROTO_FILE: return "REST_PROTO_FILE";
            case TYPE_NOTIFICATION: return "NOTIFICATION";
            case TYPE_FIRMWARE_CHUNK: return "FIRMWARE_CHUNK";
            case TYPE_GOLF_MANIFEST: return "GOLF_MANIFEST";
            case TYPE_GOLF_SCORECARDS: return "GOLF_SCORECARDS";
            default: return "TYPE_" + type;
        }
    }

    public static String fileExtension(int type) {
        switch (type) {
            case TYPE_WORKOUT: return ".ttbin";
            case TYPE_STEP_BUCKET: return ".bucket";
            case TYPE_GOLF_MANIFEST: return ".golf2";
            case TYPE_GOLF_SCORECARDS: return ".golf2";
            default: return ".dat";
        }
    }

    // ---------------------------------------------------------------
    // Protocole
    // ---------------------------------------------------------------
    public static final int PACKET_LENGTH = 20;          // octets par paquet
    public static final int PACKETS_PER_BLOCK = 256;     // paquets par bloc
    public static final int BLOCK_DATA_LENGTH = 5120;    // 256 * 20
    public static final int CRC_SIZE = 2;                // CRC16 en fin de bloc

    /** Réponses AUTH_TOKEN (octet 0 de la notification). */
    public static final int AUTH_RESPONSE_VALID = 1;
    public static final int AUTH_RESPONSE_INVALID = 2;
    public static final int AUTH_RESPONSE_RECONNECT = 3;

    /** Réponse COMMAND (octet 0). */
    public static final int COMMAND_RESPONSE_OK = 1;
    public static final int COMMAND_RESPONSE_FILE_NOT_FOUND = 0;

    /** ID fabricant TomTom dans les données de publicité BLE. */
    public static final int TOMTOM_MANUFACTURER_ID = 0x0100;

    /** Paquet de commande standard : [code, type, numLo, numHi]. */
    public static byte[] commandPacket(int command, int fileType, int fileNumber) {
        return new byte[]{
                (byte) command,
                (byte) fileType,
                (byte) (fileNumber & 0xFF),
                (byte) ((fileNumber >> 8) & 0xFF)
        };
    }

    /** Commande SET_TIME : [8, timestamp Unix 32 bits LE]. */
    public static byte[] setTimePacket() {
        long unix = System.currentTimeMillis() / 1000L;
        return new byte[]{
                (byte) CMD_SET_TIME,
                (byte) (unix & 0xFF),
                (byte) ((unix >> 8) & 0xFF),
                (byte) ((unix >> 16) & 0xFF),
                (byte) ((unix >> 24) & 0xFF)
        };
    }

    /** Paquet APP_VERSION envoyé avant le PIN : [1, sdkInt, 0, 0, 1, versionCode, 0, 0]. */
    public static byte[] appVersionPacket(int sdkInt, int versionCode) {
        return new byte[]{
                1, (byte) sdkInt, 0, 0,
                1, (byte) versionCode, 0, 0
        };
    }

    /** PIN (int 32 bits) au format little-endian. */
    public static byte[] int32le(int value) {
        return new byte[]{
                (byte) (value & 0xFF),
                (byte) ((value >> 8) & 0xFF),
                (byte) ((value >> 16) & 0xFF),
                (byte) ((value >> 24) & 0xFF)
        };
    }

    public static int leToInt(byte[] data, int offset) {
        int v = 0;
        for (int i = 3; i >= 0; i--) {
            v = (v << 8) | (data[offset + i] & 0xFF);
        }
        return v;
    }
}

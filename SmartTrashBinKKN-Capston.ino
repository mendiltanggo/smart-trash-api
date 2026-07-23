#include <WiFi.h>
#include <WiFiClientSecure.h> // <--- TAMBAHKAN BARIS INI
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
Servo servo;

//====================================================
// STATUS TERAKHIR
//====================================================
String lastStatusTutup = "";
String lastStatusSampah = "";
int lastPersentase = -1;

//====================================================
// WIFI
//====================================================
const char* ssid = "POS RT 09/13";
const char* password = "spmkamila034";
const char* serverUrl = "https://terms-captured-vbulletin-qty.trycloudflare.com/api/trash/update";

//====================================================
// PIN
//====================================================
#define TRIG1 5
#define ECHO1 18

#define TRIG2 19
#define ECHO2 21

#define SERVO_PIN 13

#define LED_HIJAU 25
#define LED_KUNING 26
#define LED_MERAH 27

//====================================================
// FILTER SENSOR & PARAMETER
//====================================================
const int SAMPLE_COUNT = 5;

// Hysteresis Sensor Sampah (Tinggi Tong: 40 cm)
const float FULL_ON = 10.0;     // Di bawah 10 cm -> Penuh
const float FULL_OFF = 12.0;    // Di atas 12 cm -> Kembali ke Sedang
const float MEDIUM_OFF = 24.0;  // Di bawah 24 cm -> Menjadi Sedang
const float MEDIUM_ON = 26.0;   // Di atas 26 cm -> Kembali ke Sedikit

// Batas Sensor Objek
const float OBJECT_ON = 10.0;   
const float OBJECT_OFF = 15.0;  

//====================================================
// VARIABEL DEBOUNCE (MENCEGAH ERROR SAMPAH JATUH)
//====================================================
float stableSampah = 40.0;         // Jarak yang sudah dikonfirmasi stabil
float tempSampah = 40.0;           // Jarak sementara yang sedang dicek
unsigned long waktuDebounce = 0;   // Timer penahan
const unsigned long WAKTU_STABIL = 5000; // Sampah harus diam selama 5 detik

// Waktu Management (Non-Blocking)
unsigned long lastSensorRead = 0;
const unsigned long SENSOR_INTERVAL = 200; 

bool tutupTerbuka = false;
bool countdownTutup = false;
bool adaObjek = false;

unsigned long mulaiHitungTutup = 0;
unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 10000;

String currentStatusSampah = "Sedikit";

//====================================================
// FUNGSI BACA ULTRASONIC
//====================================================
float bacaJarak(int trig, int echo)
{
    float data[SAMPLE_COUNT];
    int valid = 0;

    for (int i = 0; i < SAMPLE_COUNT; i++)
    {
        digitalWrite(trig, LOW);
        delayMicroseconds(2);
        digitalWrite(trig, HIGH);
        delayMicroseconds(10);
        digitalWrite(trig, LOW);

        // Timeout 20ms
        long durasi = pulseIn(echo, HIGH, 20000); 

        if (durasi > 0)
        {
            float jarak = durasi * 0.0343 / 2.0;
            
            // Filter jarak 2 cm hingga 60 cm
            if (jarak >= 2 && jarak <= 60) 
            {
                data[valid++] = jarak;
            }
        }
        
        // Jeda antar tembakan untuk mencegah gema bertabrakan
        delay(15); 
    }
    
    if (valid == 0) return -1;

    // Median Filter
    for (int i = 0; i < valid - 1; i++)
    {
        for (int j = i + 1; j < valid; j++)
        {
            if (data[j] < data[i])
            {
                float temp = data[i];
                data[i] = data[j];
                data[j] = temp;
            }
        }
    }
    return data[valid / 2];
}

String hitungStatusSampah(float jarak)
{
    if (jarak < 0) return currentStatusSampah;

    if (currentStatusSampah == "Penuh") {
        if (jarak >= FULL_OFF) currentStatusSampah = "Sedang";
    }
    else if (currentStatusSampah == "Sedang") {
        if (jarak <= FULL_ON) currentStatusSampah = "Penuh"; 
        else if (jarak >= MEDIUM_ON) currentStatusSampah = "Sedikit"; 
    }
    else {
        if (jarak <= MEDIUM_OFF) currentStatusSampah = "Sedang";
    }
    return currentStatusSampah;
}

//====================================================
// FUNGSI JARINGAN & PENGIRIMAN DATA
//====================================================
void connectWiFi()
{
    if (WiFi.status() == WL_CONNECTED) return;
    
    Serial.println("Menghubungkan WiFi...");
    WiFi.begin(ssid, password);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 8000)
    {
        delay(500);
        Serial.print(".");
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("WiFi Terhubung!");
        Serial.print("IP : ");
        Serial.println(WiFi.localIP());
    }
}

void kirimData(String statusTutup, String statusSampah, int jarakObjek, int jarakSampah, int persentase, bool heartbeat)
{
    if (WiFi.status() != WL_CONNECTED) return;

    // --- TAMBAHAN KUNCI PEMBUKA HTTPS ---
    WiFiClientSecure client; 
    client.setInsecure(); // Abaikan pengecekan sertifikat SSL Cloudflare
    // ------------------------------------

    HTTPClient http;
    http.begin(client, serverUrl); // Masukkan 'client' ke dalam http.begin
    http.useHTTP10(true);
    http.setReuse(false);
    http.setTimeout(5000); // Naikkan timeout menjadi 5000ms (5 detik) untuk proses HTTPS

    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_code"] = "TB001";
    doc["jarak_objek"] = jarakObjek;
    doc["jarak_sampah"] = jarakSampah;
    doc["status_tutup"] = statusTutup;
    doc["status_sampah"] = statusSampah;
    doc["persentase"] = persentase;
    doc["heartbeat"] = heartbeat;

    String json;
    serializeJson(doc, json);

    int httpCode = http.POST(json);

    if (!heartbeat) {
        Serial.println("\n===== KIRIM EVENT =====");
        Serial.print("HTTP Code : ");
        Serial.println(httpCode);
    }
    
    http.end();
}

void kirimEvent(String statusTutup, String statusSampah, int jarakObjek, int jarakSampah, int persentase) {
    kirimData(statusTutup, statusSampah, jarakObjek, jarakSampah, persentase, false);
}

void kirimHeartbeat(String statusTutup, String statusSampah, int jarakObjek, int jarakSampah, int persentase) {
    kirimData(statusTutup, statusSampah, jarakObjek, jarakSampah, persentase, true);
}

bool perluKirimData(String statusTutup, String statusSampah, int persentase)
{
    bool berubah = false;
    if (statusTutup != lastStatusTutup) berubah = true;
    if (statusSampah != lastStatusSampah) berubah = true;
    if (lastPersentase == -1 || abs(persentase - lastPersentase) >= 5) berubah = true;

    if (berubah)
    {
        lastStatusTutup = statusTutup;
        lastStatusSampah = statusSampah;
        lastPersentase = persentase;
    }
    return berubah;
}

//====================================================
// SETUP
//====================================================
void setup()
{
    Serial.begin(115200);

    pinMode(TRIG1, OUTPUT);
    pinMode(ECHO1, INPUT);
    pinMode(TRIG2, OUTPUT);
    pinMode(ECHO2, INPUT);

    pinMode(LED_HIJAU, OUTPUT);
    pinMode(LED_KUNING, OUTPUT);
    pinMode(LED_MERAH, OUTPUT);

    servo.setPeriodHertz(50);
    servo.attach(SERVO_PIN, 500, 2400);
    servo.write(0);

    WiFi.setAutoReconnect(true);
    WiFi.persistent(true);

    connectWiFi();
}

//====================================================
// LOOP UTAMA
//====================================================
void loop()
{
    unsigned long currentMillis = millis();

    if (currentMillis - lastSensorRead >= SENSOR_INTERVAL)
    {
        lastSensorRead = currentMillis;

        // 1. Baca Sensor Objek
        float objek = bacaJarak(TRIG1, ECHO1);
        if (objek < 0) objek = 99.0; 
        
        delay(50); 

        // 2. Baca Sensor Sampah (Mentah)
        float rawSampah = bacaJarak(TRIG2, ECHO2);
        if (rawSampah < 0) rawSampah = 40.0; 

        //=========================================================
        // Logika Debounce (Mencegah false-positive saat sampah jatuh)
        //=========================================================
        if (abs(rawSampah - tempSampah) > 2.0) 
        {
            tempSampah = rawSampah;          
            waktuDebounce = currentMillis;   
        } 
        else 
        {
            if (currentMillis - waktuDebounce >= WAKTU_STABIL) 
            {
                stableSampah = tempSampah; 
            }
        }
        
        //=========================================================
        // Logika Objek & Servo
        //=========================================================
        if (objek <= OBJECT_ON) adaObjek = true;
        else if (objek > OBJECT_OFF) adaObjek = false;

        if (adaObjek)
        {
            if (!tutupTerbuka)
            {
                servo.write(90);
                tutupTerbuka = true;
                Serial.println("Servo Dibuka");
            }
            countdownTutup = false; 
        }

        //=========================================================
        // Logika Status Sampah & Indikator LED
        //=========================================================
        String statusSampah = hitungStatusSampah(stableSampah);
        
        if (statusSampah == "Sedikit") {
            digitalWrite(LED_HIJAU, HIGH);
            digitalWrite(LED_KUNING, LOW);
            digitalWrite(LED_MERAH, LOW);
        } else if (statusSampah == "Sedang") {
            digitalWrite(LED_HIJAU, LOW);
            digitalWrite(LED_KUNING, HIGH);
            digitalWrite(LED_MERAH, LOW);
        } else {
            digitalWrite(LED_HIJAU, LOW);
            digitalWrite(LED_KUNING, LOW);
            digitalWrite(LED_MERAH, HIGH);
        }

        int persentase = 0;
        if (stableSampah >= 0) {
            persentase = round((40.0 - stableSampah) * 100.0 / 40.0);
            persentase = constrain(persentase, 0, 100);
        }

        String statusTutup = tutupTerbuka ? "Terbuka" : "Tertutup";

        // Monitor di Serial
        Serial.print("Objek: "); Serial.print(objek);
        Serial.print(" cm | Sampah: "); Serial.print(stableSampah);
        Serial.print(" cm | Status: "); Serial.println(statusTutup);

        //=========================================================
        // Pengiriman Data
        //=========================================================
        if (perluKirimData(statusTutup, statusSampah, persentase))
        {   
            kirimEvent(statusTutup, statusSampah, (int)objek, (int)stableSampah, persentase);
        }

        if (currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL)
        {
            lastHeartbeat = currentMillis;
            kirimHeartbeat(statusTutup, statusSampah, (int)objek, (int)stableSampah, persentase);
        }
    }

    //=========================================================
    // Logika Countdown Penutupan Servo
    //=========================================================
    if (!adaObjek && tutupTerbuka)
    {
        if (!countdownTutup)
        {
            countdownTutup = true;
            mulaiHitungTutup = millis();
            Serial.println("Countdown dimulai...");
        }

        if (millis() - mulaiHitungTutup >= 10000)
        {
            servo.write(0);
            tutupTerbuka = false;
            countdownTutup = false;
            Serial.println("Servo Ditutup");
        }
    }
}
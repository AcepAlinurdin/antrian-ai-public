# 🔧 Bengkel Next AI

Sistem Manajemen Bengkel Modern berbasis Web yang terintegrasi dengan **Artificial Intelligence (AI)** untuk membantu operasional, analisis keuangan, dan manajemen stok. Dibangun menggunakan **Next.js 16** dan **React 19**.

---

## 📋 Daftar Isi
1. [Fitur Utama](#-fitur-utama)
2. [Teknologi (Tech Stack)](#-teknologi-tech-stack)
3. [Akun Demo & Hak Akses](#-akun-demo--hak-akses-penting)
4. [Cara Instalasi & Menjalankan](#-cara-instalasi--menjalankan)
5. [Konfigurasi Environment](#-konfigurasi-environment)

---

## 🚀 Fitur Utama

* **Dashboard AI:** Analisis performa bengkel otomatis menggunakan Google Gemini AI.
* **Multi-Role Access:** Sistem login aman dengan pembagian akses (Owner, Admin, Kasir).
* **Point of Sale (Kasir):** Halaman transaksi cepat untuk layanan dan sparepart.
* **Manajemen Stok:** Pemantauan masuk/keluar barang.
* **Laporan Keuangan:** Grafik visual pendapatan dan pengeluaran (Recharts).
* **Manajemen Karyawan (HR):** Data mekanik dan staf.

---

## 💻 Teknologi (Tech Stack)

* **Framework:** Next.js 16 (App Router)
* **Library:** React 19
* **Language:** TypeScript
* **Styling:** Tailwind CSS
* **Icons:** Lucide React
* **AI Integration:** Google Generative AI (Gemini)
* **Charts:** Recharts
* **Database/Auth:** Supabase (Client SDK)

---

## 🔐 Akun Demo & Hak Akses (PENTING)

Gunakan akun berikut untuk menguji aplikasi sesuai dengan Role (Jabatan) masing-masing:

| Role (Jabatan) | Email | Password | Hak Akses (Permission) |
| :--- | :--- | :--- | :--- |
| **👑 OWNER** | `owner@bengkel.com` | `123456` | **Full Akses** <br> (Dashboard, Keuangan, HR, Settings, Laporan AI) |
| **🛠 ADMIN** | `admin@bengkel.com` | `123456` | **Manajemen Operasional** <br> (Stok Sparepart, Data Pelanggan, Servis) |
| **💻 KASIR** | `kasir@bengkel.com` | `123456` | **Transaksi Saja** <br> (Hanya bisa mengakses halaman Kasir/POS) |

> **Catatan:** Sistem akan otomatis melakukan *redirect* ke halaman yang sesuai setelah login berhasil.

---

## 🛠 Cara Instalasi & Menjalankan

Ikuti langkah-langkah berikut untuk menjalankan proyek di komputer lokal:

### 1. Clone Repository (atau Download)
Pastikan Anda sudah berada di folder proyek.

### 2. Install Dependencies
Jalankan perintah berikut di terminal untuk mengunduh semua library yang dibutuhkan:

```bash
npm install
# atau
yarn install
# atau
pnpm install

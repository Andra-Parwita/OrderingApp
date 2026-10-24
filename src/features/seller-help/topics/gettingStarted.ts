import type { HelpTopic } from './types';

// Help topics 1-4: first sign-in, devices, home screen.
export const GETTING_STARTED_TOPICS: ReadonlyArray<HelpTopic> = [
  // 1
  {
    en: {
      n: 'Get started',
      s: 'Sign in with your passkey',
      l: 'Everything you need the first time.',
      steps: [
        {
          text: 'Open the app link. On the **Sign in** page, tap **Sign in with face or fingerprint**. This is your passkey, so there is no password to remember.',
          pic: 'the Sign in page with the passkey button',
        },
        { text: 'No face or fingerprint on this device? Tap **Use password instead**.' },
        {
          text: 'Using a tablet and a phone? See **Use more than one device** next. To open the app with one tap, see **Put the app on your home screen**.',
        },
      ],
      note: 'Your passkey stays on this device.',
    },
    id: {
      n: 'Mulai',
      s: 'Masuk dengan passkey',
      l: 'Semua yang perlu Anda tahu di awal.',
      steps: [
        {
          text: 'Buka tautan aplikasi. Di halaman **Masuk**, ketuk **Masuk dengan wajah atau sidik jari**. Ini passkey Anda, jadi tidak ada kata sandi yang perlu diingat.',
          pic: 'halaman Masuk dengan tombol passkey',
        },
        {
          text: 'Tidak ada wajah atau sidik jari di perangkat ini? Ketuk **Pakai kata sandi saja**.',
        },
        {
          text: 'Memakai tablet dan ponsel? Lihat **Pakai lebih dari satu perangkat** berikutnya. Untuk membuka aplikasi dengan satu ketukan, lihat **Taruh aplikasi di layar utama**.',
        },
      ],
      note: 'Passkey Anda tetap ada di perangkat ini.',
    },
  },
  // 2
  {
    en: {
      n: 'Phone or tablet?',
      s: 'What each one is good for',
      l: 'The app works on both, but a phone has less room. A tablet on its side is best.',
      steps: [
        { part: 'On a phone' },
        {
          text: 'The bar at the bottom has **Orders**, **Pickup & delivery** and **More**. In **More** you find **Sell**, **Kitchen**, **Your dishes**, **Devices** and **Help**.',
          pic: 'the phone bar with Orders, Pickup & delivery and More',
        },
        {
          text: 'A phone is handy to see and update orders, add a new order, count what sells and mark pickups and deliveries when you are on the go.',
        },
        { part: 'On a tablet or computer' },
        {
          text: 'The left menu shows everything: **Home**, **Orders**, **Kitchen**, **Pickup & delivery**, **Menu**, **Settings** and **Help**.',
          pic: 'the left menu on a tablet',
        },
        {
          text: 'These need a tablet or computer: making and publishing menus (**Menu**, **Share menu**) and **Settings** (team, kitchen, pictures). On a phone they show "Open this on a tablet or computer". **Devices** works on a phone too: open **More** → **Devices**.',
        },
        { part: 'Our advice' },
        {
          text: 'Use a **tablet held sideways (landscape)** to make menus and on cooking day. You see the list and the details side by side.',
        },
        {
          text: 'Keep the phone for orders and selling on the go. You can be signed in on both at the same time: see **Use more than one device**.',
        },
      ],
      note: 'A chef sees fewer items and a helper only Orders, Pickup & delivery and Sell, on any device.',
    },
    id: {
      n: 'HP atau tablet?',
      s: 'Apa kelebihan masing-masing',
      l: 'Aplikasi jalan di keduanya, tetapi layar ponsel lebih sempit. Tablet yang dipegang menyamping paling enak.',
      steps: [
        { part: 'Di ponsel' },
        {
          text: 'Bilah di bawah berisi **Pesanan**, **Serah terima** dan **Lainnya**. Di **Lainnya** ada **Jual**, **Dapur**, **Hidangan Anda**, **Perangkat** dan **Bantuan**.',
          pic: 'bilah ponsel dengan Pesanan, Serah terima dan Lainnya',
        },
        {
          text: 'Ponsel praktis untuk melihat dan mengubah pesanan, menambah pesanan baru, menghitung yang terjual dan menandai pengambilan dan pengantaran saat Anda sedang di luar.',
        },
        { part: 'Di tablet atau komputer' },
        {
          text: 'Menu di kiri menampilkan semuanya: **Beranda**, **Pesanan**, **Dapur**, **Serah terima**, **Menu**, **Pengaturan** dan **Bantuan**.',
          pic: 'menu kiri di tablet',
        },
        {
          text: 'Ini memerlukan tablet atau komputer: membuat dan mempublikasikan menu (**Menu**, **Bagikan menu**) dan **Pengaturan** (tim, dapur, gambar). Di ponsel muncul tulisan "Buka ini di tablet atau komputer". **Perangkat** bisa dibuka di ponsel juga: buka **Lainnya** → **Perangkat**.',
        },
        { part: 'Saran kami' },
        {
          text: 'Pakai **tablet yang dipegang menyamping (lanskap)** untuk membuat menu dan di hari memasak. Daftar dan rinciannya terlihat berdampingan.',
        },
        {
          text: 'Simpan ponsel untuk pesanan dan berjualan saat bepergian. Anda bisa masuk di keduanya sekaligus: lihat **Pakai lebih dari satu perangkat**.',
        },
      ],
      note: 'Koki melihat lebih sedikit menu dan asisten hanya Pesanan, Serah terima dan Jual, di perangkat apa pun.',
    },
  },
  // 3
  {
    en: {
      n: 'Use more than one device',
      s: 'Your tablet and phone, and other people',
      l: 'Two different jobs. Pick the part that fits you.',
      steps: [
        { part: 'A · Your own tablet and phone' },
        {
          text: 'On the device that is already signed in, open **More** → **Devices** on a phone, or **Devices** in the left menu on a tablet.',
          pic: 'the Devices page',
        },
        {
          text: 'Tap **Add a device**. A 6-digit code appears. It works for 10 minutes.',
          pic: 'the 6-digit code on screen',
        },
        {
          text: 'On the new device, open order.shaggybobo.app/seller/sign-in and tap **First time on this device? Use your invite key**. Then choose the **6-digit code** tab.',
          pic: 'the 6-digit code tab',
        },
        { text: 'Type the code and tap **Continue**.' },
        {
          text: 'Choose **Face or fingerprint** to save the passkey on this device. You can write a name under **Name of this device**.',
          pic: 'the Face or fingerprint choice',
        },
        { part: 'B · Someone else (a chef, a helper)' },
        {
          text: 'Never share your passkey or lend your device. Give each person their own access with an invite.',
        },
        {
          text: 'Open **More** → **Settings** → **Team**, then **Invite someone**. Write the **Name**, pick the **Role** (**Chef** or **Helper**), tap **Make invite**.',
          pic: 'the Invite someone form',
        },
        {
          text: 'Tap **Send on WhatsApp**, or **Copy link with key**. The key is shown once, so copy it now.',
          pic: 'the invite window',
        },
        { text: 'The key works once, on one device, within 24 hours.' },
        {
          text: 'Their WhatsApp is on a different device than the tablet? Tap **Copy key**, send it, and they type it at order.shaggybobo.app/seller/setup under **Invite key**. On the tablet, someone already signed in to another kitchen can instead tap **Settings** → **Devices** → **Join another kitchen** and paste it there.',
        },
        {
          text: 'A **Chef** adds and changes their own dishes (also on the current menu), sees and updates orders, and prints them. A **Helper** only sees orders, marks dishes sold out and marks orders collected.',
        },
        { part: 'C · Join another kitchen' },
        {
          text: 'Already signed in on the tablet, and someone invites you to their kitchen? Open **Settings** → **Devices** → **Join another kitchen**, paste the key, and tap **Join**. The app opens the new kitchen. (Not on phones.)',
        },
        {
          text: 'In two or more kitchens? On the tablet, tap the kitchen name at the top of the left menu and pick one. On a phone, use the **Kitchen** choice in **More**.',
        },
      ],
      note: 'Each device keeps its own passkey. If a device is lost, open Devices, find it under Other devices and tap Sign out.',
    },
    id: {
      n: 'Pakai lebih dari satu perangkat',
      s: 'Tablet dan ponsel Anda, dan orang lain',
      l: 'Dua keperluan yang berbeda. Pilih bagian yang cocok.',
      steps: [
        { part: 'A · Tablet dan ponsel Anda sendiri' },
        {
          text: 'Di perangkat yang sudah masuk, buka **Lainnya** → **Perangkat** di ponsel, atau **Perangkat** di menu kiri di tablet.',
          pic: 'halaman Perangkat',
        },
        {
          text: 'Ketuk **Tambah perangkat**. Kode 6 angka muncul. Kode berlaku 10 menit.',
          pic: 'kode 6 angka di layar',
        },
        {
          text: 'Di perangkat baru, buka order.shaggybobo.app/seller/sign-in lalu ketuk **Pertama kali di perangkat ini? Pakai kunci undanganmu**. Lalu pilih tab **Kode 6 angka**.',
          pic: 'tab Kode 6 angka',
        },
        { text: 'Ketik kodenya lalu ketuk **Lanjut**.' },
        {
          text: 'Pilih **Wajah atau sidik jari** untuk menyimpan passkey di perangkat ini. Anda bisa menulis nama di **Nama perangkat ini**.',
          pic: 'pilihan Wajah atau sidik jari',
        },
        { part: 'B · Orang lain (koki, asisten)' },
        {
          text: 'Jangan pernah membagikan passkey atau meminjamkan perangkat Anda. Beri setiap orang akses sendiri lewat undangan.',
        },
        {
          text: 'Buka **Lainnya** → **Pengaturan** → **Tim**, lalu **Undang seseorang**. Tulis **Nama**, pilih **Peran** (**Koki** atau **Asisten**), ketuk **Buat undangan**.',
          pic: 'formulir Undang seseorang',
        },
        {
          text: 'Ketuk **Kirim lewat WhatsApp**, atau **Salin tautan dengan kunci**. Kunci hanya tampil sekali, jadi salin sekarang.',
          pic: 'jendela undangan',
        },
        { text: 'Kunci hanya berlaku sekali, di satu perangkat, dalam 24 jam.' },
        {
          text: 'WhatsApp mereka ada di perangkat lain, bukan di tablet? Ketuk **Salin kunci**, kirim, lalu mereka mengetiknya di order.shaggybobo.app/seller/setup pada **Kunci undangan**. Di tablet, yang sudah masuk di dapur lain bisa mengetuk **Pengaturan** → **Perangkat** → **Gabung dapur lain** dan menempel kuncinya di sana.',
        },
        {
          text: '**Koki** menambah dan mengubah hidangannya sendiri (juga di menu yang sedang berjalan), melihat dan mengubah pesanan, dan mencetaknya. **Asisten** hanya melihat pesanan, menandai hidangan habis dan menandai pesanan sudah diambil.',
        },
        { part: 'C · Gabung ke dapur lain' },
        {
          text: 'Sudah masuk di tablet, lalu seseorang mengundang Anda ke dapurnya? Buka **Pengaturan** → **Perangkat** → **Gabung dapur lain**, tempel kuncinya, lalu ketuk **Gabung**. Aplikasi membuka dapur yang baru. (Tidak di ponsel.)',
        },
        {
          text: 'Ada di dua dapur atau lebih? Di tablet, ketuk nama dapur di bagian atas menu kiri, lalu pilih satu. Di ponsel, pakai pilihan **Dapur** di **Lainnya**.',
        },
      ],
      note: 'Setiap perangkat punya passkey sendiri. Kalau perangkat hilang, buka Perangkat, cari di Perangkat lain lalu ketuk Keluarkan.',
    },
  },
  // 4
  {
    en: {
      n: 'Put the app on your home screen',
      s: 'iPhone, iPad and Android',
      l: 'Then you open it with one tap, like any other app. Pick your phone or tablet.',
      steps: [
        { part: 'iPhone / iPad (Safari)' },
        {
          text: 'Open order.shaggybobo.app/seller in **Safari**, not inside WhatsApp. If it opened inside WhatsApp, tap **Copy link**, open **Safari**, and paste the link in the address bar.',
          pic: 'the Safari address bar',
        },
        {
          text: 'Tap **Share**: the square with an arrow. It is at the bottom on iPhone and at the top right on iPad. (On a newer iPhone, tap **•••** at the bottom right first.)',
          pic: 'the Share button',
        },
        {
          text: 'Scroll the list and tap **Add to Home Screen**.',
          pic: 'the Add to Home Screen row',
        },
        {
          text: 'Tap **Add** at the top right. Leave **Open as Web App** switched on.',
          pic: 'the Add button',
        },
        {
          text: 'Open the app from the new **ShaggyBobo Seller** icon.',
          pic: 'the icon on the home screen',
        },
        { part: 'Android (Chrome)' },
        {
          text: 'Open the page in **Chrome**. If it opened inside WhatsApp, tap **⋮** at the top right, then **Open in Chrome**.',
          pic: 'the Chrome menu',
        },
        {
          text: 'Tap **Install the app** in the seller app (**More** on the phone, **Settings** on the tablet). Or tap **⋮** in Chrome, then **Add to home screen** or **Install app**.',
          pic: 'the Install the app row',
        },
        { text: 'Tap **Install**.', pic: 'the Install window' },
        {
          text: 'Open the app from the **ShaggyBobo Seller** icon.',
          pic: 'the icon on the home screen',
        },
      ],
      note: 'It opens full screen without the address bar, and you stay signed in. Your customers can do the same: the card "Put the kitchen on your home screen" on their menu page does it for them.',
    },
    id: {
      n: 'Taruh aplikasi di layar utama',
      s: 'iPhone, iPad dan Android',
      l: 'Lalu Anda membukanya dengan satu ketukan, seperti aplikasi lain. Pilih ponsel atau tablet Anda.',
      steps: [
        { part: 'iPhone / iPad (Safari)' },
        {
          text: 'Buka order.shaggybobo.app/seller di **Safari**, bukan di dalam WhatsApp. Kalau terbuka di dalam WhatsApp, ketuk **Salin tautan**, buka **Safari**, lalu tempel tautannya di bilah alamat.',
          pic: 'bilah alamat Safari',
        },
        {
          text: 'Ketuk **Bagikan**: kotak dengan tanda panah. Letaknya di bawah pada iPhone dan di kanan atas pada iPad. (Di iPhone yang lebih baru, ketuk **•••** di kanan bawah dulu.)',
          pic: 'tombol Bagikan',
        },
        {
          text: 'Geser daftarnya lalu ketuk **Tambah ke Layar Utama**.',
          pic: 'baris Tambah ke Layar Utama',
        },
        {
          text: 'Ketuk **Tambah** di kanan atas. Biarkan **Buka sebagai App Web** menyala.',
          pic: 'tombol Tambah',
        },
        {
          text: 'Buka aplikasi dari ikon baru **ShaggyBobo Penjual**.',
          pic: 'ikon di layar utama',
        },
        { part: 'Android (Chrome)' },
        {
          text: 'Buka halaman di **Chrome**. Kalau terbuka di dalam WhatsApp, ketuk **⋮** di kanan atas, lalu **Buka di Chrome**.',
          pic: 'menu Chrome',
        },
        {
          text: 'Ketuk **Pasang aplikasi** di aplikasi penjual (**Lainnya** di ponsel, **Pengaturan** di tablet). Atau ketuk **⋮** di Chrome, lalu **Tambahkan ke layar utama** atau **Pasang aplikasi**.',
          pic: 'baris Pasang aplikasi',
        },
        { text: 'Ketuk **Pasang**.', pic: 'jendela Pasang' },
        { text: 'Buka aplikasi dari ikon **ShaggyBobo Penjual**.', pic: 'ikon di layar utama' },
      ],
      note: 'Aplikasi terbuka layar penuh tanpa bilah alamat, dan Anda tetap masuk. Pelanggan Anda juga bisa: kartu "Taruh dapur di layar utama" di halaman menu mereka melakukannya untuk mereka.',
    },
  },
];

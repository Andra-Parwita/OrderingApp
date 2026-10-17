// The Help topics (plan 058, D-095). **bold** marks a button or label exactly as the app shows it.
// `pic` is what a picture of the step shows (its alt text); the file, if there is one, is in
// STEP_IMAGES. The app address in step texts is the product's own and does not change per kitchen.

export type HelpStep = Readonly<{ text: string; pic?: string } | { part: string }>;
export type HelpTopicText = Readonly<{
  n: string;
  s: string;
  l: string;
  steps: ReadonlyArray<HelpStep>;
  note: string;
}>;
export type HelpTopic = Readonly<{ en: HelpTopicText; id: HelpTopicText }>;

export const TOPICS: ReadonlyArray<HelpTopic> = [
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
          text: 'Their WhatsApp is on a different device than the tablet? Tap **Copy key**, send it, and they type it at order.shaggybobo.app/seller/setup under **Invite key**.',
        },
        {
          text: 'A **Chef** adds and changes their own dishes (also on the current menu), sees and updates orders, and prints them. A **Helper** only sees orders, marks dishes sold out and marks orders collected.',
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
          text: 'WhatsApp mereka ada di perangkat lain, bukan di tablet? Ketuk **Salin kunci**, kirim, lalu mereka mengetiknya di order.shaggybobo.app/seller/setup pada **Kunci undangan**.',
        },
        {
          text: '**Koki** menambah dan mengubah hidangannya sendiri (juga di menu yang sedang berjalan), melihat dan mengubah pesanan, dan mencetaknya. **Asisten** hanya melihat pesanan, menandai hidangan habis dan menandai pesanan sudah diambil.',
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
  // 5
  {
    en: {
      n: 'Add dishes',
      s: 'One by one, or many at once with a file',
      l: 'Dishes are saved once and can be used in every menu.',
      steps: [
        {
          text: 'Open **Menu**, then **Your dishes**, and tap **New dish**.',
          pic: 'Your dishes with the New dish button',
        },
        {
          text: 'Write the name. Write it in one language, then tap **⇄ From Indonesian** or **⇄ From English** to get the other. Check the result.',
          pic: 'the name fields with the translate button',
        },
        {
          text: 'Fill in the **Price**, choose the **Chef** who cooks it. Tap **Add dish**.',
          pic: 'the dish form with price and chef',
        },
        {
          text: 'Many dishes? Tap **Import**, then **Download template**. Fill the file in Excel or Google Sheets and save it as CSV.',
          pic: 'the Import window with Download template',
        },
        {
          text: 'Choose your CSV file, look at the preview, fix any lines with a problem, then tap **Import**.',
          pic: 'the import preview',
        },
        {
          text: 'Want customers to see the dish? Save it, open it again, and under **Picture** tap **Take photo** or **Choose photo**. Your phone crops it square and shrinks it. Tap **Replace** or **Remove** to change it. You can add up to 300 pictures.',
        },
      ],
      note: 'Lines with a problem are skipped. The others are imported. The import file never carries pictures.',
    },
    id: {
      n: 'Tambah hidangan',
      s: 'Satu per satu, atau banyak sekaligus dengan file',
      l: 'Hidangan disimpan sekali dan bisa dipakai di semua menu.',
      steps: [
        {
          text: 'Buka **Menu**, lalu **Hidangan Anda**, dan ketuk **Hidangan baru**.',
          pic: 'Hidangan Anda dengan tombol Hidangan baru',
        },
        {
          text: 'Tulis namanya dalam satu bahasa, lalu ketuk **⇄ Dari bahasa Indonesia** atau **⇄ Dari bahasa Inggris** untuk bahasa lainnya. Periksa hasilnya.',
          pic: 'kolom nama dengan tombol terjemah',
        },
        {
          text: 'Isi **Harga**, pilih **Koki** yang memasaknya. Ketuk **Tambah hidangan**.',
          pic: 'formulir hidangan dengan harga dan koki',
        },
        {
          text: 'Banyak hidangan? Ketuk **Impor**, lalu **Unduh templat**. Isi file di Excel atau Google Sheets dan simpan sebagai CSV.',
          pic: 'jendela Impor dengan Unduh templat',
        },
        {
          text: 'Pilih file CSV Anda, lihat pratinjau, perbaiki baris yang bermasalah, lalu ketuk **Impor**.',
          pic: 'pratinjau impor',
        },
        {
          text: 'Ingin pelanggan melihat hidangannya? Simpan, buka lagi, lalu di bawah **Foto** ketuk **Ambil foto** atau **Pilih foto**. Ponsel Anda memotongnya jadi persegi dan mengecilkannya. Ketuk **Ganti** atau **Hapus** untuk mengubahnya. Anda bisa menambah sampai 300 foto.',
        },
      ],
      note: 'Baris yang bermasalah dilewati. Yang lain tetap diimpor. File impor tidak pernah membawa foto.',
    },
  },
  // 6
  {
    en: {
      n: 'Make and publish a menu',
      s: 'Set up once, then four steps to open for orders',
      l: 'Pickup places are saved once. Each menu then has four steps.',
      steps: [
        { part: 'Before your first menu (once)' },
        {
          text: 'Open **Settings**, then **Pickup locations**, and tap **Add a place**. Write the **Place** name, the **Directions** in English and Indonesian, and the **From** and **To** times. Tap **Add place**. You can save up to 5 places.',
        },
        {
          text: 'Open **Menu defaults** in **Settings**. Choose **Offer delivery** or **No delivery**, write the delivery note for customers, and set the usual cut-off (days before the cooking day, and the time). Every new menu starts with these.',
        },
        { part: 'Make the menu' },
        {
          text: 'Open **Menu** and tap **New menu**. Pick the **Cooking day**, then tap **Start with the dishes**.',
          pic: 'the Pick the cooking day screen',
        },
        {
          text: 'Step 1, **Dishes**: tick the dishes for this menu. Or start from a saved set or a past menu in **Start from**. Need one that is not there? Tap **New dish**. Tap **Save these as a set** to keep the list for next time.',
          pic: 'the four steps along the top',
        },
        {
          text: 'Step 2, **Details**: check the **Cooking day** and when **Orders close**. At the top, under **How do customers get their food?**, choose **Pickup**, **Delivery** or **Both**. For **Delivery** or **Both**, write the **Note for customers**.',
        },
        {
          text: 'Still in **Details**, for **Pickup** or **Both**, tick the places this menu uses under **Pickup locations**. Choosing **Delivery** hides them (it asks first if places were ticked). Set the time for this menu (**From** and **To**) or keep the **Usual time**. Customers choose one place when they order. A place missing? Tap **Add a place** here.',
        },
        {
          text: 'Step 3, **Check**: see what customers will see. Change the price or limit of a dish for this menu here. Read **Worth a look** and tap the button next to anything flagged, for example **Choose places** or **Add dishes**.',
        },
        {
          text: 'Step 4, **Publish & share**: tap **Publish menu**. Choose **Publish and take orders now** to open at once.',
          pic: 'the Publish window with two choices',
        },
        {
          text: 'Not ready for orders yet? Choose **Publish, ordering paused**. Customers see the menu but cannot order.',
        },
        { part: 'After publishing' },
        {
          text: 'Paused? When you are ready, switch **Taking orders** on in **Orders**. Switch it off to stop new orders, and on again to resume.',
          pic: 'the Taking orders switch',
        },
        {
          text: 'Share the menu on WhatsApp: see **Share the menu** next. Later, tap **Share again** on the live menu.',
        },
        {
          text: 'Changing a live menu: open **Menu** and tap **Edit details**, **Add dish**, or a dish to change its price or limit. Customers see changes at once.',
        },
        {
          text: 'Done with the menu? Tap **Finish menu now**. It also finishes by itself at midnight after the cooking day and moves to **Past menus**. **Unpublish** hides it from customers.',
        },
      ],
      note: 'It is saved as you go, so you can stop and come back. Nothing in Worth a look stops you from publishing, but a menu with no pickup place and no delivery gives customers no way to get their order. A chef can add her own dish under Menu, and the owner puts it on the menu.',
    },
    id: {
      n: 'Buat dan publikasikan menu',
      s: 'Atur sekali, lalu empat langkah untuk buka pesanan',
      l: 'Tempat ambil disimpan sekali. Lalu setiap menu punya empat langkah.',
      steps: [
        { part: 'Sebelum menu pertama (sekali saja)' },
        {
          text: 'Buka **Pengaturan**, lalu **Lokasi ambil**, dan ketuk **Tambah tempat**. Tulis nama **Tempat**, **Petunjuk** dalam bahasa Inggris dan Indonesia, serta jam **Dari** dan **Sampai**. Ketuk **Tambah tempat**. Anda bisa menyimpan sampai 5 tempat.',
        },
        {
          text: 'Buka **Bawaan menu** di **Pengaturan**. Pilih **Tawarkan antar** atau **Tanpa antar**, tulis catatan antar untuk pelanggan, dan atur batas pesan yang biasa (berapa hari sebelum hari memasak, dan jamnya). Setiap menu baru dimulai dengan ini.',
        },
        { part: 'Buat menunya' },
        {
          text: 'Buka **Menu** lalu ketuk **Menu baru**. Pilih **Hari memasak**, lalu ketuk **Mulai dengan hidangan**.',
          pic: 'layar Pilih hari memasak',
        },
        {
          text: 'Langkah 1, **Hidangan**: centang hidangan untuk menu ini. Atau mulai dari paket tersimpan atau menu lalu di **Mulai dari**. Butuh yang belum ada? Ketuk **Hidangan baru**. Ketuk **Simpan sebagai paket** untuk menyimpan daftarnya.',
          pic: 'empat langkah di bagian atas',
        },
        {
          text: 'Langkah 2, **Rincian**: periksa **Hari memasak** dan kapan **Pesanan ditutup**. Di bagian atas, di bawah **Bagaimana pelanggan mendapat makanannya?**, pilih **Ambil sendiri**, **Diantar** atau **Keduanya**. Untuk **Diantar** atau **Keduanya**, tulis **Catatan untuk pelanggan**.',
        },
        {
          text: 'Masih di **Rincian**, untuk **Ambil sendiri** atau **Keduanya**, centang tempat yang dipakai menu ini di bawah **Lokasi pengambilan**. Memilih **Diantar** menyembunyikannya (ditanya dulu jika ada tempat yang dicentang). Atur jam untuk menu ini (**Dari** dan **Sampai**) atau pakai **Jam biasa**. Pelanggan memilih satu tempat saat memesan. Tempatnya belum ada? Ketuk **Tambah tempat** di sini.',
        },
        {
          text: 'Langkah 3, **Periksa**: lihat apa yang dilihat pelanggan. Ubah harga atau batas hidangan untuk menu ini di sini. Baca **Perlu dilihat** dan ketuk tombol di samping yang ditandai, misalnya **Pilih tempat** atau **Tambah hidangan**.',
        },
        {
          text: 'Langkah 4, **Publikasi & bagikan**: ketuk **Publikasikan menu**. Pilih **Publikasikan dan terima pesanan sekarang** untuk langsung buka.',
          pic: 'jendela Publikasi dengan dua pilihan',
        },
        {
          text: 'Belum siap menerima pesanan? Pilih **Publikasikan, pemesanan dijeda**. Pelanggan melihat menu tetapi belum bisa memesan.',
        },
        { part: 'Setelah dipublikasikan' },
        {
          text: 'Dijeda? Kalau sudah siap, nyalakan **Menerima pesanan** di **Pesanan**. Matikan untuk menghentikan pesanan baru, nyalakan lagi untuk melanjutkan.',
          pic: 'tombol Menerima pesanan',
        },
        {
          text: 'Bagikan menu di WhatsApp: lihat **Bagikan menu** berikutnya. Nanti, ketuk **Bagikan lagi** di menu yang tayang.',
        },
        {
          text: 'Mengubah menu yang tayang: buka **Menu** lalu ketuk **Ubah rincian**, **Tambah hidangan**, atau sebuah hidangan untuk mengubah harga atau batasnya. Pelanggan langsung melihat perubahannya.',
        },
        {
          text: 'Menu sudah selesai? Ketuk **Selesaikan menu sekarang**. Menu juga selesai sendiri tengah malam setelah hari memasak dan pindah ke **Menu lalu**. **Tarik menu** menyembunyikannya dari pelanggan.',
        },
      ],
      note: 'Tersimpan otomatis, jadi boleh berhenti dan lanjut nanti. Tidak ada isi Perlu dilihat yang menghalangi publikasi, tetapi menu tanpa tempat ambil dan tanpa antar membuat pelanggan tidak punya cara menerima pesanan. Koki bisa menambah hidangannya sendiri di Menu, lalu pemilik memasukkannya ke menu.',
    },
  },
  // 7
  {
    en: {
      n: 'Share the menu',
      s: 'WhatsApp post and the order link',
      l: 'Customers order from a link you send them.',
      steps: [
        { text: 'In **Orders**, tap **Share menu**.', pic: 'the Share menu button' },
        {
          text: 'Pick the **Language of the post**. The message with your dishes and prices is ready.',
          pic: 'the post preview',
        },
        {
          text: 'Tap **Share to WhatsApp**. Or tap **Copy text** and paste it into your group or status.',
        },
        {
          text: 'Want to send only the link? Tap **Copy order link**.',
          pic: 'the link preview in WhatsApp',
        },
      ],
      note: 'Customers need no account. They open the link and order.',
    },
    id: {
      n: 'Bagikan menu',
      s: 'Postingan WhatsApp dan tautan pesanan',
      l: 'Pelanggan memesan lewat tautan yang Anda kirim.',
      steps: [
        { text: 'Di **Pesanan**, ketuk **Bagikan menu**.', pic: 'tombol Bagikan menu' },
        {
          text: 'Pilih **Bahasa postingan**. Pesan berisi hidangan dan harga sudah siap.',
          pic: 'pratinjau postingan',
        },
        {
          text: 'Ketuk **Bagikan ke WhatsApp**. Atau ketuk **Salin teks** lalu tempel di grup atau status Anda.',
        },
        {
          text: 'Mau kirim tautannya saja? Ketuk **Salin tautan pesanan**.',
          pic: 'pratinjau tautan di WhatsApp',
        },
      ],
      note: 'Pelanggan tidak perlu akun. Mereka cukup buka tautan dan memesan.',
    },
  },
  // 8
  {
    en: {
      n: 'Orders',
      s: 'See, find and update orders',
      l: 'Each order has a number. The customer sends it to you on WhatsApp.',
      steps: [
        { text: 'Open **Orders**. New orders show at the top.', pic: 'the Orders list' },
        {
          text: 'The customer sends you their order number on WhatsApp. Type it in **Name or code** to find the order.',
        },
        {
          text: 'Tap the order and change its status, for example **Confirmed**, **Ready**, **Collected**. The customer is told.',
          pic: 'the status buttons of an order',
        },
        {
          text: 'Tap **Print orders** to print the list for cooking day.',
          pic: 'the Print orders page',
        },
      ],
      note: 'There are no payments in the app. You and the customer agree on payment yourselves.',
    },
    id: {
      n: 'Pesanan',
      s: 'Lihat, cari dan ubah status pesanan',
      l: 'Setiap pesanan punya nomor. Pelanggan mengirimnya ke Anda lewat WhatsApp.',
      steps: [
        { text: 'Buka **Pesanan**. Pesanan baru ada di paling atas.', pic: 'daftar Pesanan' },
        {
          text: 'Pelanggan mengirim nomor pesanan lewat WhatsApp. Ketik di **Nama atau kode** untuk menemukan pesanannya.',
        },
        {
          text: 'Ketuk pesanan lalu ubah statusnya, misalnya **Dikonfirmasi**, **Siap**, **Diambil**. Pelanggan akan diberi tahu.',
          pic: 'tombol status pesanan',
        },
        {
          text: 'Ketuk **Cetak pesanan** untuk mencetak daftar di hari memasak.',
          pic: 'halaman Cetak pesanan',
        },
      ],
      note: 'Tidak ada pembayaran di aplikasi. Anda dan pelanggan mengatur pembayaran sendiri.',
    },
  },
  // 9
  {
    en: {
      n: 'Sell on the day',
      s: 'Count what sells',
      l: 'Use the Sell screen on cooking day.',
      steps: [
        {
          text: 'Open **Sell**. You see each dish with how many are left.',
          pic: 'the Sell screen',
        },
        { text: 'Sold one at the door? Tap that dish to count it.' },
        { text: 'Tapped by mistake? Tap **Undo** right away.', pic: 'the Undo button' },
        {
          text: 'At the end of the day, open **Summary** to see what sold and what is left.',
          pic: 'the Summary tab',
        },
      ],
      note: 'A dish that reaches 0 shows as sold out to customers.',
    },
    id: {
      n: 'Berjualan di hari H',
      s: 'Hitung yang terjual',
      l: 'Pakai layar Jual di hari memasak.',
      steps: [
        { text: 'Buka **Jual**. Setiap hidangan tampil dengan sisanya.', pic: 'layar Jual' },
        { text: 'Terjual satu di tempat? Ketuk hidangan itu untuk menghitungnya.' },
        { text: 'Salah ketuk? Segera ketuk **Batalkan**.', pic: 'tombol Batalkan' },
        {
          text: 'Di akhir hari, buka **Ringkasan** untuk melihat yang terjual dan yang tersisa.',
          pic: 'tab Ringkasan',
        },
      ],
      note: 'Hidangan yang mencapai 0 tampil habis bagi pelanggan.',
    },
  },
  // 10
  {
    en: {
      n: 'Your team',
      s: 'See who has access, remove someone',
      l: 'To invite someone new, see Use more than one device, part B.',
      steps: [
        {
          text: 'Open **More** → **Settings** → **Team**. Everyone with access is listed with their role: **Owner**, **Chef** or **Helper**.',
          pic: 'the Team page',
        },
        { text: 'Under each name you see how many devices they are signed in on.' },
        {
          text: "To take away someone's access, tap **Remove**, then tap again to confirm.",
          pic: 'the Remove button',
        },
        { text: 'If they cooked dishes, give those dishes to someone else in the menu.' },
      ],
      note: 'Removing a person does not delete their dishes.',
    },
    id: {
      n: 'Tim Anda',
      s: 'Lihat siapa yang punya akses, hapus seseorang',
      l: 'Untuk mengundang orang baru, lihat Pakai lebih dari satu perangkat, bagian B.',
      steps: [
        {
          text: 'Buka **Lainnya** → **Pengaturan** → **Tim**. Semua orang yang punya akses tampil dengan perannya: **Pemilik**, **Koki** atau **Asisten**.',
          pic: 'halaman Tim',
        },
        { text: 'Di bawah setiap nama terlihat mereka masuk di berapa perangkat.' },
        {
          text: 'Untuk mencabut akses seseorang, ketuk **Hapus**, lalu ketuk lagi untuk memastikan.',
          pic: 'tombol Hapus',
        },
        { text: 'Kalau mereka memasak hidangan, berikan hidangan itu ke orang lain di menu.' },
      ],
      note: 'Menghapus seseorang tidak menghapus hidangannya.',
    },
  },
  // 11
  {
    en: {
      n: 'Your kitchen',
      s: 'Pictures, languages, WhatsApp post',
      l: 'Settings that customers see.',
      steps: [
        { text: 'Open **More** → **Settings** → **Kitchen**.', pic: 'the Kitchen settings' },
        {
          text: 'Under **Kitchen pictures**, add your banner, small icon and menu picture. Use clear, bright pictures.',
          pic: 'the picture slots',
        },
        {
          text: 'Under **Languages for customers**, choose **English and Indonesian**. Customers can switch between the two. You can fill in both languages or just one: the other then shows the same text.',
          pic: 'the languages choice',
        },
        {
          text: 'Tap **⇄ From Indonesian** or **⇄ From English** next to a text to fill the other language for you. Check the result.',
        },
        {
          text: 'Choose **English only** or **Indonesian only** and customers see just that language. You then type every dish name and description once, in that language.',
        },
        { text: 'Change your greeting and closing in **WhatsApp post**.' },
      ],
      note: 'Changes show to customers at once. Kitchens that already existed start on both languages.',
    },
    id: {
      n: 'Dapur Anda',
      s: 'Gambar, bahasa, postingan WhatsApp',
      l: 'Pengaturan yang dilihat pelanggan.',
      steps: [
        { text: 'Buka **Lainnya** → **Pengaturan** → **Dapur**.', pic: 'pengaturan Dapur' },
        {
          text: 'Di **Gambar dapur**, tambah banner, ikon kecil dan gambar menu. Pakai gambar yang jelas dan terang.',
          pic: 'tempat gambar',
        },
        {
          text: 'Di **Bahasa untuk pelanggan**, pilih **Inggris dan Indonesia**. Pelanggan bisa berganti di antara keduanya. Anda boleh mengisi kedua bahasa atau satu saja: bahasa lainnya menampilkan teks yang sama.',
          pic: 'pilihan bahasa',
        },
        {
          text: 'Ketuk **⇄ Dari bahasa Indonesia** atau **⇄ Dari bahasa Inggris** di samping teks untuk mengisi bahasa lainnya. Periksa hasilnya.',
        },
        {
          text: 'Pilih **Hanya Inggris** atau **Hanya Indonesia** dan pelanggan hanya melihat bahasa itu. Anda lalu mengetik setiap nama dan deskripsi hidangan sekali saja, dalam bahasa itu.',
        },
        { text: 'Ubah sapaan dan penutup di **Postingan WhatsApp**.' },
      ],
      note: 'Perubahan langsung terlihat oleh pelanggan. Dapur yang sudah ada mulai dengan kedua bahasa.',
    },
  },
  // 12
  {
    en: {
      n: 'If something goes wrong',
      s: 'Cannot sign in, new phone, who to ask',
      l: 'Most problems are easy to fix.',
      steps: [
        {
          text: 'Cannot sign in? Ask the owner for a new invite (see Use more than one device, part B).',
        },
        {
          text: 'A passkey does not work? On the **Sign in** page tap **Use password instead**, if you set a password.',
        },
        {
          text: 'New phone? Sign in on your old device, open **More** → **Devices**, tap **Add a device**, and follow part A.',
        },
        {
          text: 'Lost a device? Open **Devices**, find it under **Other devices** and tap **Sign out**.',
        },
        {
          text: 'See **A new version is ready** at the bottom? First save what you are typing, then tap **Refresh**.',
        },
        {
          text: 'The app looks odd or old after an update? Close it completely and open it again. **iPhone / iPad:** swipe up from the bottom and hold (or press the Home button twice), swipe the app up and away, then open it again from its icon. **Android:** tap the square button for recent apps (or swipe up and hold), swipe the app away, then open it again. You stay signed in.',
        },
        {
          text: 'Still stuck? Message the owner on WhatsApp. Tell them what you tapped and what you saw.',
        },
      ],
      note: 'Never share your passkey. Ask for an invite instead.',
    },
    id: {
      n: 'Kalau ada masalah',
      s: 'Tidak bisa masuk, ponsel baru, tanya siapa',
      l: 'Kebanyakan masalah mudah diatasi.',
      steps: [
        {
          text: 'Tidak bisa masuk? Minta undangan baru ke pemilik (lihat Pakai lebih dari satu perangkat, bagian B).',
        },
        {
          text: 'Passkey tidak berfungsi? Di halaman **Masuk** ketuk **Pakai kata sandi saja**, kalau Anda sudah mengatur kata sandi.',
        },
        {
          text: 'Ponsel baru? Masuk di perangkat lama, buka **Lainnya** → **Perangkat**, ketuk **Tambah perangkat**, dan ikuti bagian A.',
        },
        {
          text: 'Perangkat hilang? Buka **Perangkat**, cari di **Perangkat lain** lalu ketuk **Keluarkan**.',
        },
        {
          text: 'Melihat **Versi baru siap** di bagian bawah? Simpan dulu yang sedang Anda ketik, lalu ketuk **Muat ulang**.',
        },
        {
          text: 'Aplikasi tampak aneh atau lama setelah pembaruan? Tutup sepenuhnya lalu buka lagi. **iPhone / iPad:** geser ke atas dari bawah dan tahan (atau tekan tombol Home dua kali), geser aplikasi ke atas sampai hilang, lalu buka lagi dari ikonnya. **Android:** ketuk tombol kotak untuk aplikasi terbaru (atau geser ke atas dan tahan), geser aplikasi sampai hilang, lalu buka lagi. Anda tetap masuk.',
        },
        {
          text: 'Masih bingung? Kirim pesan ke pemilik lewat WhatsApp. Ceritakan apa yang Anda ketuk dan apa yang tampil.',
        },
      ],
      note: 'Jangan bagikan passkey Anda. Mintalah undangan.',
    },
  },
  // 13 (plan 071, D-099)
  {
    en: {
      n: 'Customer addresses and deliveries',
      s: 'Where addresses are kept, Directions, your customer list',
      l: 'For delivery orders. Plain words, no tech needed.',
      steps: [
        { part: 'Where an address is kept' },
        {
          text: 'A customer types their address when they order for delivery. The app keeps it **scrambled (encrypted)** and only your kitchen team (owner, chefs, helpers) can read it. It is never in the customer menu, labels or the WhatsApp post.',
        },
        {
          text: 'It is deleted automatically **one day after your menu ends**, or when the order is cancelled. You can also tap **Delete address now** on the order.',
        },
        { part: 'Delivering' },
        {
          text: "Open **Deliveries** to see the day's delivery orders: name, address, items. Tap **Directions** to open Google Maps (Apple Maps on iPhone), then **Delivered** when done.",
        },
        {
          text: 'Notes for the driver (gate, unit, "call when here") show on the order, but are not sent to Maps.',
        },
        { part: 'Your customer list (on this device only)' },
        {
          text: "Phone numbers are never kept in the cloud. If you type a customer's number on an order, it is saved in a list on **this device only**, so **Call** and **WhatsApp** show next time.",
        },
        {
          text: 'When you **Confirm** an order from a phone this device has not seen, the app asks **Link to a saved customer?** Tap **Link** next to the right person, **New customer** for someone new, or **Skip**. After linking, their next orders show their saved number automatically.',
        },
        { part: 'Back up and restore' },
        {
          text: 'When a menu finishes and there is new customer data, the app asks **Back up your customer details?** Tap **Download backup** to save a file named like customers-yourkitchen-2026-10-13.csv. **Later** asks again next time you open the app.',
        },
        {
          text: 'New phone, or cleared data? Open **Customer details** (Settings, or **More** on a phone), tap **Upload CSV**, check the preview, then **Add to my customers**. It adds and updates, and never deletes anything.',
        },
        { part: "If an address says 'not available'" },
        { text: 'It can happen now and then. The order itself is fine.' },
        {
          text: 'Tap **WhatsApp** (or **Call**) on the order and ask the customer for the address, or ask them to open their order and enter it again.',
        },
        { text: 'If many orders show it at once, tell ShaggyBobo (the admin).' },
        { part: 'Keep it safe' },
        {
          text: "The backup file has your customers' numbers and addresses. **Keep it private**: do not post it or send it in a group. Delete old copies you do not need.",
        },
      ],
      note: 'Keep it safe: the backup file is private. Only share it with yourself.',
    },
    id: {
      n: 'Alamat pelanggan dan pengantaran',
      s: 'Di mana alamat disimpan, Petunjuk arah, daftar pelanggan',
      l: 'Untuk pesanan antar. Bahasa sederhana, tanpa perlu paham teknis.',
      steps: [
        { part: 'Di mana alamat disimpan' },
        {
          text: 'Pelanggan mengetik alamat saat memesan untuk diantar. Aplikasi menyimpannya **diacak (terenkripsi)** dan hanya tim dapur Anda (pemilik, koki, pembantu) yang bisa membacanya. Alamat tidak pernah ada di menu pelanggan, label, atau kiriman WhatsApp.',
        },
        {
          text: 'Alamat dihapus otomatis **satu hari setelah menu berakhir**, atau saat pesanan dibatalkan. Anda juga bisa mengetuk **Hapus alamat sekarang** di pesanan.',
        },
        { part: 'Mengantar' },
        {
          text: 'Buka **Pengantaran** untuk melihat pesanan antar hari itu: nama, alamat, isi pesanan. Ketuk **Petunjuk arah** untuk membuka Google Maps (Apple Maps di iPhone), lalu **Terantar** setelah selesai.',
        },
        {
          text: 'Catatan untuk pengantar (gerbang, unit, "telepon kalau sudah sampai") tampil di pesanan, tetapi tidak dikirim ke Maps.',
        },
        { part: 'Daftar pelanggan Anda (hanya di perangkat ini)' },
        {
          text: 'Nomor telepon tidak pernah disimpan di cloud. Jika Anda mengetik nomor pelanggan di pesanan, nomor itu disimpan di daftar **hanya di perangkat ini**, sehingga **Telepon** dan **WhatsApp** muncul lain kali.',
        },
        {
          text: 'Saat Anda **Konfirmasi** pesanan dari ponsel yang belum dikenal perangkat ini, aplikasi bertanya **Hubungkan ke pelanggan tersimpan?** Ketuk **Hubungkan** di samping orang yang benar, **Pelanggan baru** untuk orang baru, atau **Lewati**. Setelah terhubung, pesanan berikutnya otomatis menampilkan nomor tersimpannya.',
        },
        { part: 'Cadangkan dan pulihkan' },
        {
          text: 'Saat menu selesai dan ada data pelanggan baru, aplikasi bertanya **Cadangkan data pelanggan Anda?** Ketuk **Unduh cadangan** untuk menyimpan file bernama seperti customers-dapuranda-2026-10-13.csv. **Nanti** akan bertanya lagi saat aplikasi dibuka berikutnya.',
        },
        {
          text: 'Ponsel baru, atau data terhapus? Buka **Data pelanggan** (Pengaturan, atau **Lainnya** di ponsel), ketuk **Unggah CSV**, periksa pratinjau, lalu **Tambahkan ke pelanggan saya**. Ini menambah dan memperbarui, dan tidak pernah menghapus.',
        },
        { part: "Jika alamat tertulis 'tidak tersedia'" },
        { text: 'Ini kadang terjadi. Pesanannya sendiri tidak apa-apa.' },
        {
          text: 'Ketuk **WhatsApp** (atau **Telepon**) di pesanan lalu minta alamat ke pelanggan, atau minta mereka membuka pesanannya dan memasukkan alamat lagi.',
        },
        { text: 'Jika banyak pesanan menampilkannya sekaligus, kabari ShaggyBobo (admin).' },
        { part: 'Jaga keamanannya' },
        {
          text: 'File cadangan berisi nomor dan alamat pelanggan Anda. **Simpan secara pribadi**: jangan diposting atau dikirim ke grup. Hapus salinan lama yang tidak perlu.',
        },
      ],
      note: 'Jaga keamanannya: file cadangan bersifat pribadi. Kirim hanya ke diri sendiri.',
    },
  },
  // 14 (plan 081, D-104)
  {
    en: {
      n: 'Private orders',
      s: 'A one-off order for an event, made by you',
      l: 'For a birthday, a party or a big order. It is not on your menu.',
      steps: [
        { part: 'Make one' },
        {
          text: 'On a tablet or computer, open **Private** in the left menu (under **Orders**). On a phone, open **More** → **Private**. Tap **New private order**. Only owners can make, change or cancel one.',
        },
        {
          text: 'Pick the **date** and **time** of the event. A new order starts on **Delivery**: type the street address. For **Pickup**, pick one of your pickup places. The address is kept private and deleted one day after the event.',
        },
        {
          text: "Type the customer's **name** and a **note** if you like. There is no phone number: you talk to them on WhatsApp.",
        },
        { part: 'Dishes and payment' },
        {
          text: 'Pick the dishes from your **dish library**, the same way as when you make a menu. Change the quantity and the price for this order only. Need something new? Add a **New dish**: it is saved to your library so you can use it again.',
        },
        {
          text: 'Under **Payment**, tap **Paid**, or **Not paid** with a **Deposit paid** amount. The app shows **Still to pay**. You take the money yourself.',
        },
        { part: 'Send the code' },
        {
          text: 'Tap **Save order**, then **Send code on WhatsApp**. Your customer opens the link to see the order, its status and what is still to pay. They cannot change it: they message you, and you edit the order with **Edit**.',
        },
        { part: 'On the day' },
        {
          text: 'On the event day each delivery in the **Private** list has a **Directions** button that opens the maps app. **View on map** is there too, and in **Deliveries**.',
        },
        {
          text: "The dishes are counted in **Cook**, a bag for each private order is in **Pack**, labels print, and each chef's income shows a **Private** block. They carry a small **Private** tag. Owners, chefs and helpers can move the status along (**Ready**, **Handed over** or **Out for delivery**, **Delivered**).",
        },
        { part: 'Cancel' },
        {
          text: 'Open the order and tap **Cancel order**, then **Yes, cancel**. It moves to **Past** marked **Cancelled**, and your customer sees it as cancelled.',
        },
      ],
      note: 'Private orders never touch your menu, its limits or its cut-off.',
    },
    id: {
      n: 'Pesanan khusus',
      s: 'Pesanan satu kali untuk sebuah acara, dibuat oleh Anda',
      l: 'Untuk ulang tahun, pesta, atau pesanan besar. Tidak ada di menu Anda.',
      steps: [
        { part: 'Membuatnya' },
        {
          text: 'Di tablet atau komputer, buka **Khusus** di menu kiri (di bawah **Pesanan**). Di ponsel, buka **Lainnya** → **Khusus**. Ketuk **Pesanan khusus baru**. Hanya pemilik yang bisa membuat, mengubah, atau membatalkannya.',
        },
        {
          text: 'Pilih **tanggal** dan **jam** acara. Pesanan baru dimulai dari **Antar**: ketik alamat jalannya. Untuk **Ambil sendiri**, pilih salah satu tempat ambil Anda. Alamat dirahasiakan dan dihapus sehari setelah acara.',
        },
        {
          text: 'Ketik **nama** pelanggan dan **catatan** jika perlu. Tidak ada nomor telepon: Anda berbicara dengan mereka lewat WhatsApp.',
        },
        { part: 'Hidangan dan pembayaran' },
        {
          text: 'Pilih hidangan dari **pustaka hidangan** Anda, sama seperti saat membuat menu. Ubah jumlah dan harga hanya untuk pesanan ini. Perlu yang baru? Tambah **Hidangan baru**: tersimpan di pustaka Anda sehingga bisa dipakai lagi.',
        },
        {
          text: 'Di **Pembayaran**, ketuk **Lunas**, atau **Belum bayar** dengan jumlah **DP dibayar**. Aplikasi menampilkan **Masih harus dibayar**. Uangnya Anda terima sendiri.',
        },
        { part: 'Kirim kodenya' },
        {
          text: 'Ketuk **Simpan pesanan**, lalu **Kirim kode lewat WhatsApp**. Pelanggan membuka tautan untuk melihat pesanan, statusnya, dan sisa pembayaran. Mereka tidak bisa mengubahnya: mereka menghubungi Anda, dan Anda mengubah pesanan dengan **Ubah**.',
        },
        { part: 'Di hari acara' },
        {
          text: 'Di hari acara, setiap pesanan antar di daftar **Khusus** punya tombol **Rute** yang membuka aplikasi peta. **Lihat di peta** juga ada di sana, dan di **Pengantaran**.',
        },
        {
          text: 'Hidangannya ikut dihitung di **Masak**, tiap pesanan khusus punya satu kantong di **Kemas**, label bisa dicetak, dan pendapatan tiap koki menampilkan blok **Khusus**. Semuanya bertanda kecil **Khusus**. Pemilik, koki, dan pembantu bisa memajukan statusnya (**Siap**, **Diserahkan** atau **Sedang diantar**, **Terantar**).',
        },
        { part: 'Membatalkan' },
        {
          text: 'Buka pesanan lalu ketuk **Batalkan pesanan**, kemudian **Ya, batalkan**. Pesanan pindah ke **Lalu** dengan tanda **Dibatalkan**, dan pelanggan melihatnya sebagai dibatalkan.',
        },
      ],
      note: 'Pesanan khusus tidak pernah menyentuh menu, batas, atau batas waktu pesan Anda.',
    },
  },
];

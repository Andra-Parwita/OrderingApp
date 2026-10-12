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
      n: 'Use more than one device',
      s: 'Your tablet and phone, and other people',
      l: 'Two different jobs. Pick the part that fits you.',
      steps: [
        { part: 'A · Your own tablet and phone' },
        {
          text: 'On the device that is already signed in, open **More** → **Devices**.',
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
          text: 'Di perangkat yang sudah masuk, buka **Lainnya** → **Perangkat**.',
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
  // 3
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
  // 4
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
          text: 'Fill in the **Price**, choose the **Chef** who cooks it, add a picture if you like. Tap **Add dish**.',
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
      ],
      note: 'Lines with a problem are skipped. The others are imported.',
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
          text: 'Isi **Harga**, pilih **Koki** yang memasaknya, tambah gambar kalau mau. Ketuk **Tambah hidangan**.',
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
      ],
      note: 'Baris yang bermasalah dilewati. Yang lain tetap diimpor.',
    },
  },
  // 5
  {
    en: {
      n: 'Make and publish a menu',
      s: 'Four steps, then open for orders',
      l: 'A menu has four steps. Go through them one by one.',
      steps: [
        {
          text: 'Open **Menu** and tap **New menu**. Pick the cooking day, then **Start with the dishes**.',
          pic: 'the Pick the cooking day screen',
        },
        {
          text: 'The four steps are **Dishes**, **Details**, **Check** and **Publish & share**. Fill in each one, then tap **Continue to step 2** (and so on).',
          pic: 'the four steps along the top',
        },
        {
          text: 'On the last step, tap **Publish menu**. Choose **Publish and take orders now** to open at once.',
          pic: 'the Publish window with two choices',
        },
        {
          text: 'Not ready for orders yet? Choose **Publish, ordering paused**. Customers see the menu but cannot order.',
        },
        {
          text: 'When you are ready, switch **Taking orders** on in **Orders**.',
          pic: 'the Taking orders switch',
        },
      ],
      note: 'It is saved as you go, so you can stop and come back.',
    },
    id: {
      n: 'Buat dan publikasikan menu',
      s: 'Empat langkah, lalu buka pesanan',
      l: 'Satu menu punya empat langkah. Isi satu per satu.',
      steps: [
        {
          text: 'Buka **Menu** lalu ketuk **Menu baru**. Pilih hari memasak, lalu **Mulai dengan hidangan**.',
          pic: 'layar Pilih hari memasak',
        },
        {
          text: 'Empat langkahnya: **Hidangan**, **Rincian**, **Periksa** dan **Publikasi & bagikan**. Isi satu per satu, lalu ketuk **Lanjut ke langkah 2** (dan seterusnya).',
          pic: 'empat langkah di bagian atas',
        },
        {
          text: 'Di langkah terakhir, ketuk **Publikasikan menu**. Pilih **Publikasikan dan terima pesanan sekarang** untuk langsung buka.',
          pic: 'jendela Publikasi dengan dua pilihan',
        },
        {
          text: 'Belum siap menerima pesanan? Pilih **Publikasikan, pemesanan dijeda**. Pelanggan melihat menu tetapi belum bisa memesan.',
        },
        {
          text: 'Kalau sudah siap, nyalakan **Menerima pesanan** di **Pesanan**.',
          pic: 'tombol Menerima pesanan',
        },
      ],
      note: 'Tersimpan otomatis, jadi boleh berhenti dan lanjut nanti.',
    },
  },
  // 6
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
  // 7
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
  // 8
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
  // 9
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
  // 10
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
  // 11
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
];

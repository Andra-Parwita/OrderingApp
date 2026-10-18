import type { HelpTopic } from './types';

// Help topics 8-12: orders, selling, team, kitchen, problems.
export const DAY_TOPICS: ReadonlyArray<HelpTopic> = [
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
];

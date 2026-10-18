import type { HelpTopic } from './types';

// Help topics 5-7: dishes, menu, sharing.
export const MENU_TOPICS: ReadonlyArray<HelpTopic> = [
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
];

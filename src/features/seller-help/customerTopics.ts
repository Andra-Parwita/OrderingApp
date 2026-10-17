import type { HelpTopic } from './topics';

// The "Customer help" tab: one question a customer asks the seller per topic, answered in short
// steps. Names in **bold** are the customer app's own strings (My orders, Find my order, ...).
export const CUSTOMER_TOPICS: ReadonlyArray<HelpTopic> = [
  // 1
  {
    en: {
      n: 'How does a customer order?',
      s: 'From the menu link to the order number',
      l: 'No account and no app to install. They need your menu link.',
      steps: [
        { text: 'They open the menu link you shared and add the dishes they want.' },
        {
          text: 'They tap **View basket**, then write their first name. It is remembered next time.',
        },
        { text: 'They choose pickup or delivery. They only see what your menu offers.' },
        { text: 'They tap **Place order**. They get an order number, like K7F-2QX.' },
        {
          text: 'They send the order number to you on WhatsApp. The message already includes their private order link.',
        },
      ],
      note: 'You then confirm and update the order: see Orders in Seller help.',
    },
    id: {
      n: 'Bagaimana pelanggan memesan?',
      s: 'Dari tautan menu sampai nomor pesanan',
      l: 'Tanpa akun dan tanpa aplikasi yang dipasang. Mereka hanya perlu tautan menu Anda.',
      steps: [
        {
          text: 'Mereka membuka tautan menu yang Anda bagikan dan menambah hidangan yang diinginkan.',
        },
        {
          text: 'Mereka mengetuk **Lihat keranjang**, lalu menulis nama depan. Nama diingat untuk berikutnya.',
        },
        { text: 'Mereka memilih ambil atau antar. Yang tampil hanya yang ditawarkan menu Anda.' },
        { text: 'Mereka mengetuk **Pesan**. Mereka mendapat nomor pesanan, misalnya K7F-2QX.' },
        {
          text: 'Mereka mengirim nomor pesanan ke Anda lewat WhatsApp. Pesannya sudah berisi tautan pesanan pribadi mereka.',
        },
      ],
      note: 'Lalu Anda mengonfirmasi dan mengubah status pesanan: lihat Pesanan di Bantuan penjual.',
    },
  },
  // 2
  {
    en: {
      n: 'My customer lost their order. How do they get it back?',
      s: 'Four ways',
      l: 'The order is not lost. It is saved on the server.',
      steps: [
        { part: 'Way 1 · Their WhatsApp chat' },
        { text: 'They scroll up in their own chat with you and tap the order link they sent.' },
        { part: 'Way 2 · Find my order' },
        {
          text: 'They open your kitchen link, then **My orders**. They type the order number and the first name on the order, then tap **Find my order**.',
        },
        {
          text: 'Two wrong tries on the same order number lock it for 15 minutes. Ask them to check the number and the name before trying again.',
        },
        { part: 'Way 3 · You send the link again' },
        { text: 'In **Orders**, open the order and tap **Send link on WhatsApp**.' },
        { part: 'Way 4 · Remember me, on a new phone' },
        {
          text: 'If they turned on **Remember me**, they open **My orders** on the new phone, tap **Restore them** and unlock with their face or fingerprint. Their orders, first name and saved address come back.',
        },
      ],
      note: 'Find my order searches the last kitchen they used on that phone.',
    },
    id: {
      n: 'Pelanggan saya kehilangan pesanannya. Bagaimana mendapatkannya lagi?',
      s: 'Empat cara',
      l: 'Pesanannya tidak hilang. Pesanan tersimpan di server.',
      steps: [
        { part: 'Cara 1 · Chat WhatsApp mereka' },
        {
          text: 'Mereka menggulir ke atas di chat mereka dengan Anda lalu mengetuk tautan pesanan yang mereka kirim.',
        },
        { part: 'Cara 2 · Cari pesanan saya' },
        {
          text: 'Mereka membuka tautan dapur Anda, lalu **Pesanan saya**. Mereka mengetik nomor pesanan dan nama depan di pesanan, lalu mengetuk **Cari pesanan saya**.',
        },
        {
          text: 'Dua kali salah pada nomor pesanan yang sama mengunci pesanan itu selama 15 menit. Minta mereka memeriksa nomor dan nama sebelum mencoba lagi.',
        },
        { part: 'Cara 3 · Anda kirim tautannya lagi' },
        { text: 'Di **Pesanan**, buka pesanannya dan ketuk **Kirim tautan lewat WhatsApp**.' },
        { part: 'Cara 4 · Ingat aku, di ponsel baru' },
        {
          text: 'Kalau mereka menyalakan **Ingat aku**, mereka membuka **Pesanan saya** di ponsel baru, mengetuk **Pulihkan** lalu membuka kunci dengan wajah atau sidik jari. Pesanan, nama depan, dan alamat tersimpan mereka kembali.',
        },
      ],
      note: 'Cari pesanan saya mencari di dapur terakhir yang mereka pakai di ponsel itu.',
    },
  },
  // 3
  {
    en: {
      n: 'My customer gets no order updates.',
      s: 'Turn on Order updates',
      l: 'Updates arrive as a phone notification when you change the status of an order.',
      steps: [
        {
          text: 'They open **Settings**, switch **Order updates** on, and tap **Allow** when the phone asks.',
        },
        {
          text: 'On an iPhone, they first put the kitchen on their home screen and open it from there. Inside WhatsApp it does not work.',
        },
        {
          text: 'It says "Blocked in your phone\'s settings"? On a phone, they allow Notifications for the kitchen in the phone settings. On a computer, they click the lock icon next to the address, then **Notifications** → **Allow**.',
        },
        {
          text: 'On a computer with Chrome, updates also arrive when Chrome is closed if "Continue running background apps when Google Chrome is closed" is on in chrome://settings/system.',
        },
      ],
      note: 'Their order page always shows the latest status, with or without updates.',
    },
    id: {
      n: 'Pelanggan saya tidak mendapat kabar pesanan.',
      s: 'Nyalakan Kabar pesanan',
      l: 'Kabar datang sebagai notifikasi di ponsel saat Anda mengubah status pesanan.',
      steps: [
        {
          text: 'Mereka membuka **Pengaturan**, menyalakan **Kabar pesanan**, dan mengetuk **Izinkan** saat ponsel bertanya.',
        },
        {
          text: 'Di iPhone, mereka lebih dulu menaruh dapur di layar utama dan membukanya dari sana. Di dalam WhatsApp tidak bisa.',
        },
        {
          text: 'Tertulis "Diblokir di pengaturan ponsel"? Di ponsel, mereka mengizinkan Notifikasi untuk dapur itu di pengaturan ponsel. Di komputer, mereka mengklik ikon gembok di samping alamat, lalu **Notifikasi** → **Izinkan**.',
        },
        {
          text: 'Di komputer dengan Chrome, kabar juga sampai saat Chrome ditutup jika "Lanjutkan menjalankan aplikasi latar belakang saat Google Chrome ditutup" menyala di chrome://settings/system.',
        },
      ],
      note: 'Halaman pesanan mereka selalu menampilkan status terbaru, dengan atau tanpa kabar.',
    },
  },
  // 4
  {
    en: {
      n: 'How does a customer put the app on their home screen?',
      s: 'One tap to open, like any app',
      l: 'On their menu page they see the card "Put <kitchen> on your home screen".',
      steps: [
        {
          text: 'They tap **Add to home screen** on that card. The same card is in their **Settings**.',
        },
        { text: 'On Android with Chrome, they confirm with **Install**.' },
        {
          text: 'On an iPhone, **Show me how** walks them through it. They must use Safari, not WhatsApp.',
        },
      ],
      note: 'For your own app, see Put the app on your home screen in Seller help.',
    },
    id: {
      n: 'Bagaimana pelanggan menaruh aplikasi di layar utama?',
      s: 'Satu ketukan untuk membuka, seperti aplikasi lain',
      l: 'Di halaman menu mereka ada kartu "Taruh <dapur> di layar utama".',
      steps: [
        {
          text: 'Mereka mengetuk **Tambah ke layar utama** di kartu itu. Kartu yang sama ada di **Pengaturan** mereka.',
        },
        { text: 'Di Android dengan Chrome, mereka mengonfirmasi dengan **Pasang**.' },
        {
          text: 'Di iPhone, **Tunjukkan caranya** memandu mereka. Mereka harus memakai Safari, bukan WhatsApp.',
        },
      ],
      note: 'Untuk aplikasi Anda sendiri, lihat Taruh aplikasi di layar utama di Bantuan penjual.',
    },
  },
  // 5
  {
    en: {
      n: 'The app looks old or odd for my customer.',
      s: 'Refresh, or close and reopen',
      l: 'The app updates itself, but an app left open can keep showing an older version.',
      steps: [
        { text: 'If they see **A new version is ready**, they tap **Refresh**.' },
        {
          text: 'Still old or odd? They close the app completely and open it again. Their orders are kept.',
        },
      ],
      note: 'How to close an app completely is in If something goes wrong, in Seller help.',
    },
    id: {
      n: 'Aplikasi tampak lama atau aneh bagi pelanggan saya.',
      s: 'Muat ulang, atau tutup lalu buka lagi',
      l: 'Aplikasi memperbarui dirinya sendiri, tetapi aplikasi yang dibiarkan terbuka bisa tetap menampilkan versi lama.',
      steps: [
        { text: 'Kalau mereka melihat **Versi baru sudah siap**, mereka mengetuk **Muat ulang**.' },
        {
          text: 'Masih lama atau aneh? Mereka menutup aplikasi sepenuhnya lalu membukanya lagi. Pesanan mereka tetap ada.',
        },
      ],
      note: 'Cara menutup aplikasi sepenuhnya ada di Kalau ada masalah, di Bantuan penjual.',
    },
  },
  // 6
  {
    en: {
      n: 'Why does my customer see only one language?',
      s: 'It follows your Languages for customers setting',
      l: 'You choose what customers can see.',
      steps: [
        { text: 'Open **More** → **Settings** → **Kitchen**, then **Languages for customers**.' },
        { text: 'With **English only** or **Indonesian only**, customers see just that language.' },
        {
          text: 'With **English and Indonesian**, customers can switch language in their **Settings**.',
        },
      ],
      note: 'More about it in Your kitchen, in Seller help.',
    },
    id: {
      n: 'Mengapa pelanggan saya hanya melihat satu bahasa?',
      s: 'Mengikuti pengaturan Bahasa untuk pelanggan',
      l: 'Anda memilih apa yang bisa dilihat pelanggan.',
      steps: [
        { text: 'Buka **Lainnya** → **Pengaturan** → **Dapur**, lalu **Bahasa untuk pelanggan**.' },
        {
          text: 'Dengan **Hanya Inggris** atau **Hanya Indonesia**, pelanggan hanya melihat bahasa itu.',
        },
        {
          text: 'Dengan **Inggris dan Indonesia**, pelanggan bisa berganti bahasa di **Pengaturan** mereka.',
        },
      ],
      note: 'Selengkapnya di Dapur Anda, di Bantuan penjual.',
    },
  },
  // 7
  {
    en: {
      n: 'Why does my customer see orders from other kitchens?',
      s: 'My orders is for the whole phone',
      l: 'It is normal. Nothing is shared with you.',
      steps: [
        {
          text: '**My orders** lists the orders saved on that phone, from every kitchen they ordered from.',
        },
        { text: 'Each order shows the name of its kitchen, so they can tell them apart.' },
        { text: 'You only see the orders made at your own kitchen.' },
      ],
      note: 'Orders are saved on the phone only, with no account.',
    },
    id: {
      n: 'Mengapa pelanggan saya melihat pesanan dari dapur lain?',
      s: 'Pesanan saya berlaku untuk seluruh ponsel',
      l: 'Itu wajar. Tidak ada yang dibagikan ke Anda.',
      steps: [
        {
          text: '**Pesanan saya** menampilkan pesanan yang tersimpan di ponsel itu, dari setiap dapur tempat mereka memesan.',
        },
        { text: 'Setiap pesanan menampilkan nama dapurnya, jadi mudah dibedakan.' },
        { text: 'Anda hanya melihat pesanan yang dibuat di dapur Anda sendiri.' },
      ],
      note: 'Pesanan hanya tersimpan di ponsel, tanpa akun.',
    },
  },
  // 8
  {
    en: {
      n: 'Why does the app ask my customer for an address? Who sees it?',
      s: 'Delivery addresses, kept safe',
      l: 'Only for delivery orders, and only your kitchen team can see it.',
      steps: [
        {
          text: 'On a delivery order, the customer fills in street, suburb and postcode, and optionally notes for the driver and their map location.',
        },
        {
          text: 'It is stored **encrypted**. Only your team (owner, chefs and helpers) sees it, on the order, with **Directions**.',
        },
        {
          text: 'It is deleted automatically **one day after your menu ends**, or when the order is cancelled. You can also tap **Delete address now** on the order.',
        },
        {
          text: 'A customer who wants it removed sooner asks you on WhatsApp. Phone numbers are never stored in the app.',
        },
      ],
      note: 'The customer sees this explained in your kitchen name, right under the address fields.',
    },
    id: {
      n: 'Mengapa aplikasi meminta alamat pelanggan saya? Siapa yang melihatnya?',
      s: 'Alamat pengantaran, disimpan dengan aman',
      l: 'Hanya untuk pesanan antar, dan hanya tim dapur Anda yang bisa melihatnya.',
      steps: [
        {
          text: 'Pada pesanan antar, pelanggan mengisi jalan, daerah, dan kode pos, serta (boleh) catatan untuk pengantar dan lokasi peta.',
        },
        {
          text: 'Alamat disimpan **terenkripsi**. Hanya tim Anda (pemilik, koki, dan pembantu) yang melihatnya, di pesanan, dengan **Petunjuk arah**.',
        },
        {
          text: 'Alamat dihapus otomatis **satu hari setelah menu Anda selesai**, atau saat pesanan dibatalkan. Anda juga bisa mengetuk **Hapus alamat sekarang** di pesanan.',
        },
        {
          text: 'Pelanggan yang ingin alamatnya dihapus lebih cepat cukup menghubungi Anda lewat WhatsApp. Nomor telepon tidak pernah disimpan di aplikasi.',
        },
      ],
      note: 'Pelanggan melihat penjelasan ini atas nama dapur Anda, tepat di bawah kolom alamat.',
    },
  },
  // 9
  {
    en: {
      n: 'What is Remember me?',
      s: 'An optional passkey that keeps a customer’s data',
      l: 'No email, no password and no phone number. Only a passkey: their face, fingerprint or phone PIN.',
      steps: [
        {
          text: 'It keeps their orders, first name and saved address, so they come back on any phone they use.',
        },
        {
          text: 'The saved address is locked so only their own phones can read it. It is deleted after 30 days without an order.',
        },
        {
          text: 'On their orders you see **✓ Passkey-confirmed · C-xxxx**. It tells you the order comes from the same customer as before.',
        },
        {
          text: 'To turn it on, they tap the **🔒 Remember me** chip on the menu, or go to **Settings** → **Remember me**.',
        },
        {
          text: 'To turn it off, they go to **Settings** → **Remember me** → **Delete my saved data**.',
        },
      ],
      note: 'It is optional. Customers who do not turn it on order exactly as before.',
    },
    id: {
      n: 'Apa itu Ingat aku?',
      s: 'Passkey opsional yang menyimpan data pelanggan',
      l: 'Tanpa email, tanpa kata sandi, dan tanpa nomor telepon. Hanya passkey: wajah, sidik jari, atau PIN ponsel mereka.',
      steps: [
        {
          text: 'Passkey menyimpan pesanan, nama depan, dan alamat tersimpan mereka, jadi semuanya kembali di ponsel mana pun yang mereka pakai.',
        },
        {
          text: 'Alamat tersimpan dikunci agar hanya ponsel mereka sendiri yang bisa membacanya. Alamat dihapus setelah 30 hari tanpa pesanan.',
        },
        {
          text: 'Di pesanan mereka Anda melihat **✓ Dikonfirmasi passkey · C-xxxx**. Itu menandakan pesanan datang dari pelanggan yang sama seperti sebelumnya.',
        },
        {
          text: 'Untuk menyalakannya, mereka mengetuk chip **🔒 Ingat aku** di menu, atau buka **Pengaturan** → **Ingat aku**.',
        },
        {
          text: 'Untuk mematikannya, mereka buka **Pengaturan** → **Ingat aku** → **Hapus data tersimpanku**.',
        },
      ],
      note: 'Ini opsional. Pelanggan yang tidak menyalakannya memesan seperti biasa.',
    },
  },
  // 10
  {
    en: {
      n: 'My customer sees "Too many orders in a short time".',
      s: 'A safety limit, not a fault',
      l: 'One phone can place about 5 new orders per 10 minutes, per kitchen. Changing an existing order is not limited.',
      steps: [
        { text: 'They wait a few minutes, then place the order again.' },
        {
          text: 'Or they send you the order on WhatsApp and you enter it yourself as a seller order. Seller orders are not limited.',
        },
      ],
      note: 'The limit protects your kitchen from accidental or abusive floods of orders.',
    },
    id: {
      n: 'Pelanggan saya melihat "Terlalu banyak pesanan dalam waktu singkat".',
      s: 'Batas pengaman, bukan kerusakan',
      l: 'Satu ponsel bisa membuat sekitar 5 pesanan baru per 10 menit, per dapur. Mengubah pesanan yang sudah ada tidak dibatasi.',
      steps: [
        { text: 'Mereka menunggu beberapa menit, lalu memesan lagi.' },
        {
          text: 'Atau mereka mengirim pesanan ke Anda lewat WhatsApp dan Anda memasukkannya sendiri sebagai pesanan penjual. Pesanan penjual tidak dibatasi.',
        },
      ],
      note: 'Batas ini melindungi dapur Anda dari banjir pesanan yang tidak disengaja atau disalahgunakan.',
    },
  },
];

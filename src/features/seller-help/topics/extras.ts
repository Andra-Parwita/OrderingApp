import type { HelpTopic } from './types';

// Help topics 13-16: addresses, private orders, printing, remember me.
export const EXTRA_TOPICS: ReadonlyArray<HelpTopic> = [
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
          text: "When you **Confirm** an order from a phone this device has not seen, a window says **Order K7Q2MD is confirmed.** and asks if the customer is already in your list. If it found people with that name, tap **This is them** next to the right one (check the last digits and last order date). For someone new, type the name and, if you have it, the WhatsApp number, then tap **Add to my list**. **Ask me next time** changes nothing; **Don't ask for this order** stops the question for that order.",
        },
        {
          text: 'After you pick **This is them**, their next orders show their saved number and address automatically.',
        },
        { part: 'See and edit your customers' },
        {
          text: 'Open **Customer details** (Settings, or **More** on a phone). The list is A to Z with the last 3 digits of the number, a short address and the last order date. Two customers with the same name show as **2 × Anin**. Type in **Search** to find one.',
        },
        {
          text: 'Tap a customer to **edit** the first name, WhatsApp number and address, then **Save**. Tap **Add customer** to type a new one yourself; they are linked the first time they order from a phone. **Delete customer** removes them from this device only: their past orders stay, and they come back if you upload a backup file that has them.',
        },
        { part: 'Back up and restore' },
        {
          text: 'When a menu finishes and there is new customer data, the app asks **Back up your customer details?** Tap **Download backup** to save a file named like customers-yourkitchen-2026-10-13.csv. **Later** asks again next time you open the app.',
        },
        {
          text: 'New phone, or cleared data? Open **Customer details** (Settings, or **More** on a phone), tap **Upload**, check the preview, then **Add to my customers**. It adds and updates, and never deletes anything.',
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
          text: 'Saat Anda **Konfirmasi** pesanan dari ponsel yang belum dikenal perangkat ini, muncul jendela **Pesanan K7Q2MD sudah dikonfirmasi.** yang bertanya apakah pelanggan sudah ada di daftar Anda. Jika ada orang dengan nama itu, ketuk **Ini dia** di samping yang benar (periksa digit terakhir dan tanggal pesanan terakhir). Untuk orang baru, ketik nama dan, jika ada, nomor WhatsApp, lalu ketuk **Tambah ke daftar saya**. **Tanya lagi nanti** tidak mengubah apa pun; **Jangan tanya untuk pesanan ini** menghentikan pertanyaan untuk pesanan itu.',
        },
        {
          text: 'Setelah Anda memilih **Ini dia**, pesanan berikutnya otomatis menampilkan nomor dan alamat tersimpannya.',
        },
        { part: 'Lihat dan ubah pelanggan Anda' },
        {
          text: 'Buka **Data pelanggan** (Pengaturan, atau **Lainnya** di ponsel). Daftar urut A sampai Z dengan 3 digit terakhir nomor, alamat singkat, dan tanggal pesanan terakhir. Dua pelanggan dengan nama sama tampil sebagai **2 × Anin**. Ketik di **Cari** untuk menemukan seseorang.',
        },
        {
          text: 'Ketuk pelanggan untuk **mengubah** nama depan, nomor WhatsApp, dan alamat, lalu **Simpan**. Ketuk **Tambah pelanggan** untuk mengetik pelanggan baru sendiri; mereka terhubung saat pertama kali memesan dari ponsel. **Hapus pelanggan** hanya menghapus dari perangkat ini: pesanan lamanya tetap ada, dan datanya kembali jika Anda mengunggah file cadangan yang memuatnya.',
        },
        { part: 'Cadangkan dan pulihkan' },
        {
          text: 'Saat menu selesai dan ada data pelanggan baru, aplikasi bertanya **Cadangkan data pelanggan Anda?** Ketuk **Unduh cadangan** untuk menyimpan file bernama seperti customers-dapuranda-2026-10-13.csv. **Nanti** akan bertanya lagi saat aplikasi dibuka berikutnya.',
        },
        {
          text: 'Ponsel baru, atau data terhapus? Buka **Data pelanggan** (Pengaturan, atau **Lainnya** di ponsel), ketuk **Unggah**, periksa pratinjau, lalu **Tambahkan ke pelanggan saya**. Ini menambah dan memperbarui, dan tidak pernah menghapus.',
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
  // 15
  {
    en: {
      n: 'How to print',
      s: 'Labels and order lists on a normal A4 printer',
      l: 'Every Print button shows a preview first, so you see what to expect.',
      steps: [
        { part: 'Where to print' },
        {
          text: 'Labels: **More** → **Labels**. Pick which orders, check the preview, then tap **Print**.',
        },
        {
          text: 'One bag: in **Kitchen** → **Pack**, tap **Print label**. It opens **Labels** with that order selected, so you see the preview before you print.',
        },
        {
          text: 'Order list: **Orders** → **Print**. The preview shows the A4 pages with the totals.',
        },
        { part: 'Paper' },
        {
          text: 'Labels print on plain A4, or on A4 sticker sheets with 14 labels per sheet (99.1 × 38.1 mm), for example Avery L7163 or "14-up address labels" from Officeworks or Kmart. Load the sheet the right way up and print one page first.',
        },
        {
          text: 'In the printer window, set the paper to **A4** and the scale to **100%** (turn **Fit to page** off). If the printout looks different from the preview, this is almost always why.',
        },
        {
          text: 'On a Samsung or other Android tablet: tap **Print**, choose your printer at the top, set **Paper size** to **A4** and the scale to **100%**. If your printer is not listed, install its print service from the Play Store first.',
        },
        { part: 'A label printer (optional)' },
        {
          text: 'Most sellers do not need one. If you have a label printer, open **More** → **Labels** → **Printer settings** and switch on **I have a label printer (62 mm roll)**. The **Paper** choice then appears. It is saved on that device only.',
        },
        {
          text: "For example a Brother QL-810W (Wi-Fi) with the Brother DK-22205 62 mm roll from Officeworks. On a Samsung tablet, install Brother's print plugin first.",
        },
        { part: 'Scanner (optional)' },
        {
          text: "A Bluetooth 2D / QR scanner can scan the QR on a customer's phone, or the QR on a label, at pickup. Pair it with the tablet, tap the search box in **Pickup & delivery**, **Orders** or **Pack**, and scan: the order appears.",
        },
      ],
      note: 'Nothing is sent to the printer until you tap Print in the print window.',
    },
    id: {
      n: 'Cara mencetak',
      s: 'Label dan daftar pesanan dengan printer A4 biasa',
      l: 'Setiap tombol Cetak menampilkan pratinjau dulu, jadi Anda tahu hasilnya.',
      steps: [
        { part: 'Di mana mencetak' },
        {
          text: 'Label: **Lainnya** → **Label**. Pilih pesanan mana, periksa pratinjau, lalu ketuk **Cetak**.',
        },
        {
          text: 'Satu kantong: di **Dapur** → **Kemas**, ketuk **Cetak label**. Halaman **Label** terbuka dengan pesanan itu terpilih, jadi Anda melihat pratinjau sebelum mencetak.',
        },
        {
          text: 'Daftar pesanan: **Pesanan** → **Cetak**. Pratinjau menampilkan halaman A4 beserta totalnya.',
        },
        { part: 'Kertas' },
        {
          text: 'Label dicetak di kertas A4 biasa, atau di lembar stiker A4 berisi 14 label per lembar (99,1 × 38,1 mm), misalnya Avery L7163 atau "14-up address labels" dari Officeworks atau Kmart. Masukkan lembar dengan arah yang benar dan cetak satu halaman dulu.',
        },
        {
          text: 'Di jendela printer, atur kertas ke **A4** dan skala ke **100%** (matikan **Fit to page**). Kalau hasil cetak beda dari pratinjau, hampir selalu ini penyebabnya.',
        },
        {
          text: 'Di tablet Samsung atau Android lain: ketuk **Cetak**, pilih printer di bagian atas, atur **Ukuran kertas** ke **A4** dan skala ke **100%**. Kalau printer Anda tidak ada di daftar, pasang dulu layanan cetaknya dari Play Store.',
        },
        { part: 'Printer label (opsional)' },
        {
          text: 'Kebanyakan penjual tidak membutuhkannya. Kalau Anda punya printer label, buka **Lainnya** → **Label** → **Pengaturan printer** dan nyalakan **Saya punya printer label (rol 62 mm)**. Pilihan **Kertas** lalu muncul. Tersimpan di perangkat itu saja.',
        },
        {
          text: 'Misalnya Brother QL-810W (Wi-Fi) dengan rol Brother DK-22205 62 mm dari Officeworks. Di tablet Samsung, pasang dulu plugin cetak Brother.',
        },
        { part: 'Pemindai (opsional)' },
        {
          text: 'Pemindai 2D / QR Bluetooth bisa memindai QR di ponsel pelanggan, atau QR di label, saat pengambilan. Pasangkan dengan tablet, ketuk kotak cari di **Serah terima**, **Pesanan** atau **Kemas**, lalu pindai: pesanannya muncul.',
        },
      ],
      note: 'Tidak ada yang dikirim ke printer sebelum Anda mengetuk Cetak di jendela cetak.',
    },
  },
  // 16
  {
    en: {
      n: 'Remember me (customers)',
      s: 'The optional passkey your customers can turn on',
      l: 'Customers can keep their orders on every phone. You never have to do anything.',
      steps: [
        { part: 'What it is' },
        {
          text: 'A customer can turn on **Remember me**. It is a passkey on their phone (face, fingerprint or phone PIN): no email, no password, no phone number. Their orders, first name and saved delivery address then follow them to any phone they use.',
        },
        {
          text: 'It is optional. Customers who do not use it order exactly as before.',
        },
        { part: 'What you see' },
        {
          text: 'An order placed while a customer is signed in shows **✓ Passkey-confirmed · C-7K3M** next to their name. The code is the same at every order from that person in your kitchen, so you know it is really them.',
        },
        {
          text: 'Another kitchen sees a different code for the same person. Nobody can link a customer across kitchens.',
        },
        { part: 'What you cannot see' },
        {
          text: 'No email, no phone number and no account ID. You never see their saved address except inside an order, as today. It is locked with their passkey, so not even we can read it.',
        },
        { part: 'How customers turn it off' },
        {
          text: 'In the customer app: **Settings** → **Remember me** → **Delete my saved data**. Everything on our side is deleted at once. Their phone keeps its own My orders, and their orders still work from the link.',
        },
        {
          text: 'The passkey itself stays in their phone password manager until they remove it (iPhone: Settings → Passwords; Android: Google Password Manager). It does nothing without our data.',
        },
      ],
      note: 'A Remember me that is not used for 12 months is deleted automatically.',
    },
    id: {
      n: 'Ingat aku (pelanggan)',
      s: 'Passkey opsional yang bisa dinyalakan pelanggan',
      l: 'Pelanggan bisa menyimpan pesanan di semua HP-nya. Anda tidak perlu melakukan apa pun.',
      steps: [
        { part: 'Apa itu' },
        {
          text: 'Pelanggan bisa menyalakan **Ingat aku**. Ini passkey di HP mereka (wajah, sidik jari, atau PIN HP): tanpa email, tanpa kata sandi, tanpa nomor HP. Pesanan, nama depan, dan alamat antar tersimpan mereka lalu ikut ke HP mana pun yang mereka pakai.',
        },
        {
          text: 'Sifatnya opsional. Pelanggan yang tidak memakainya memesan persis seperti sebelumnya.',
        },
        { part: 'Yang Anda lihat' },
        {
          text: 'Pesanan yang dibuat saat pelanggan sudah masuk menampilkan **✓ Dikonfirmasi passkey · C-7K3M** di samping namanya. Kodenya sama di setiap pesanan orang itu di dapur Anda, jadi Anda tahu itu benar dia.',
        },
        {
          text: 'Dapur lain melihat kode yang berbeda untuk orang yang sama. Tidak ada yang bisa menghubungkan pelanggan antar dapur.',
        },
        { part: 'Yang tidak bisa Anda lihat' },
        {
          text: 'Tidak ada email, nomor HP, atau ID akun. Alamat tersimpan mereka hanya terlihat di dalam pesanan, seperti biasa. Alamat itu dikunci dengan passkey mereka, jadi kami pun tidak bisa membacanya.',
        },
        { part: 'Cara pelanggan mematikannya' },
        {
          text: 'Di aplikasi pelanggan: **Pengaturan** → **Ingat aku** → **Hapus data tersimpanku**. Semua di sisi kami dihapus sekaligus. HP mereka tetap menyimpan Pesananku sendiri, dan pesanan tetap bisa dibuka dari tautannya.',
        },
        {
          text: 'Passkey-nya tetap ada di pengelola kata sandi HP sampai mereka menghapusnya (iPhone: Pengaturan → Kata Sandi; Android: Google Password Manager). Tanpa data kami, passkey itu tidak berguna.',
        },
      ],
      note: 'Ingat aku yang tidak dipakai selama 12 bulan dihapus otomatis.',
    },
  },
];

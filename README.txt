# Selamat datang di p5.js

Anda telah mengunduh file ZIP pustaka p5.js lengkap, hore!

# Menjalankan Server
npx serve .

# Isi folder p5

* file p5.js
* file p5.min.js
* folder addons
  * p5.sound.js
  * p5.sound.min.js
* folder empty-example
  * index.html
  * p5.js
  * p5.sound.js
  * sketch.js

## p5.js

File ini memuat pustaka p5.js secara lengkap. File ini mudah dibaca oleh manusia, jadi jangan ragu untuk membukanya dan menjelajahi isinya. File ini juga memiliki sistem pesan kesalahan yang ramah pengguna, yang membantu pemrogram pemula mengatasi kesalahan umum yang sering terjadi.

## p5.min.js

File ini adalah versi *minified* (yang telah diperkecil ukurannya) dari file p5.js. Ini adalah versi yang lebih ringan dengan fungsionalitas yang sama, namun memiliki ukuran file yang lebih kecil. Versi *minified* ini lebih sulit dibaca oleh manusia dan tidak menyertakan sistem pesan kesalahan yang ramah pengguna tersebut.

## folder addons

Folder addons berisi pustaka tambahan yang terkait dengan p5.js, baik dalam versi asli maupun versi *minified*.

### p5.sound.js, p5.sound.min.js

p5.sound memperluas kemampuan p5.js dengan fungsionalitas Web Audio, termasuk input audio, pemutaran (*playback*), analisis, dan sintesis.

## folder empty-example

Ini adalah contoh struktur situs web dasar yang kosong. Folder ini berisi file utama situs web (index.html), pustaka p5.js, pustaka p5.js terkait lainnya, serta templat awal untuk sketsa p5.js Anda yang bernama sketch.js.

### index.html

index.html adalah templat untuk file HTML. File index.html ini pertama-tama mengimpor pustaka yang ada di dalam folder (p5.js, p5.sound.js), kemudian memuat dan menjalankan file sketch.js, tempat Anda dapat menulis kode Anda sendiri. ### sketch.js

sketch.js adalah templat untuk sketsa p5.js, yang memuat fungsi setup() dan draw() untuk Anda lengkapi.

## README.txt

Berkas README ini diformat menggunakan Markdown :)

# Apa langkah selanjutnya?

Jika Anda memerlukan informasi lebih lanjut untuk memulai, silakan kunjungi situs web kami:  
https://p5js.org/tutorials/get-started/ dan https://p5js.org/tutorials/

Referensi daring untuk pustaka p5.js tersedia di sini:  
https://p5js.org/reference/

Untuk menjalankan situs web Anda (termasuk contoh kosong/empty-example), Anda perlu mengaktifkan server lokal; silakan lihat tutorial ini di wiki kami:  
https://github.com/processing/p5.js/wiki/Local-server

p5.js adalah sebuah komunitas dan dibangun melalui kontribusi. Jika Anda ingin mengetahui lebih lanjut tentang kami, kunjungi:  
https://p5js.org/community/

# Lisensi

Pustaka p5.js adalah perangkat lunak bebas; Anda dapat mendistribusikan ulang dan/atau memodifikasinya berdasarkan ketentuan GNU Lesser General Public License sebagaimana diterbitkan oleh Free Software Foundation, versi 2.1.

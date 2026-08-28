<?php
/**
 * Plugin Name: Headless Setup — WordPress → Next.js
 * Description: Custom post type, field ACF, pratinjau draft, webhook revalidasi, dan pengetatan keamanan untuk WordPress yang dipakai sebagai CMS headless.
 * Version:     1.0.0
 * Author:      Muhammad Aditia
 *
 * ---------------------------------------------------------------------------
 * Cara memasang
 * ---------------------------------------------------------------------------
 * Salin berkas ini ke `wp-content/plugins/headless-setup/headless-setup.php`
 * lalu aktifkan dari menu Plugins. (Bisa juga ditempel ke `functions.php` tema
 * child, tetapi sebagai plugin ia ikut hidup meski temanya diganti.)
 *
 * Rahasianya disimpan di `wp-config.php`, bukan di dalam kode:
 *
 *   define('NEXTJS_SITE_URL',          'https://situs-anda.com');
 *   define('NEXTJS_REVALIDATE_SECRET', 'string-acak-panjang');   // = REVALIDATE_SECRET
 *   define('NEXTJS_PREVIEW_SECRET',    'string-acak-lain');      // = WP_PREVIEW_SECRET
 *   define('DISALLOW_FILE_EDIT',       true);                    // matikan editor berkas
 *
 * Untuk membaca draft, Next.js memakai Application Password milik satu akun
 * editor (Users → Profile → Application Passwords), diisikan ke `WP_USER` dan
 * `WP_APP_PASSWORD` di sisi Next.js.
 * ---------------------------------------------------------------------------
 */

if (!defined('ABSPATH')) {
    exit; // dipanggil langsung lewat URL — hentikan
}

const HEADLESS_TIPE_KONTEN = ['post', 'produk', 'video', 'faq'];

/* ═══════════════════════════════════════════════════════════════════
   1. Custom Post Type
   ═══════════════════════════════════════════════════════════════════
   `show_in_rest` wajib true — tanpa itu, CPT tidak muncul di REST API dan
   Next.js tidak akan pernah melihatnya. `rest_base` sengaja disamakan dengan
   nama tipe supaya endpoint-nya terbaca: /wp-json/wp/v2/produk
   ------------------------------------------------------------------- */

add_action('init', 'headless_daftarkan_post_type');

function headless_daftarkan_post_type(): void
{
    register_post_type('produk', [
        'labels' => [
            'name'          => 'Produk',
            'singular_name' => 'Produk',
            'add_new_item'  => 'Tambah Produk',
            'edit_item'     => 'Sunting Produk',
            'search_items'  => 'Cari Produk',
        ],
        'public'        => true,
        'has_archive'   => true,
        'menu_icon'     => 'dashicons-cart',
        'menu_position' => 21,
        'supports'      => ['title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'custom-fields'],
        'taxonomies'    => ['kategori_produk'],
        'show_in_rest'  => true,
        'rest_base'     => 'produk',
    ]);

    register_post_type('video', [
        'labels' => [
            'name'          => 'Video',
            'singular_name' => 'Video',
            'add_new_item'  => 'Tambah Video',
            'edit_item'     => 'Sunting Video',
        ],
        'public'        => true,
        'has_archive'   => true,
        'menu_icon'     => 'dashicons-video-alt3',
        'menu_position' => 22,
        'supports'      => ['title', 'editor', 'excerpt', 'thumbnail', 'revisions', 'custom-fields'],
        'show_in_rest'  => true,
        'rest_base'     => 'video',
    ]);

    register_post_type('faq', [
        'labels' => [
            'name'          => 'FAQ',
            'singular_name' => 'FAQ',
            'add_new_item'  => 'Tambah Pertanyaan',
            'edit_item'     => 'Sunting Pertanyaan',
        ],
        'public'        => true,
        'has_archive'   => false,
        'menu_icon'     => 'dashicons-editor-help',
        'menu_position' => 23,
        // Judul = pertanyaan, isi = jawaban. Sengaja sesederhana mungkin
        // supaya editor tidak perlu diajari apa pun.
        'supports'      => ['title', 'editor', 'revisions'],
        'taxonomies'    => ['topik_faq'],
        'show_in_rest'  => true,
        'rest_base'     => 'faq',
    ]);
}

/* ═══════════════════════════════════════════════════════════════════
   2. Taxonomy
   ═══════════════════════════════════════════════════════════════════ */

add_action('init', 'headless_daftarkan_taxonomy');

function headless_daftarkan_taxonomy(): void
{
    register_taxonomy('kategori_produk', ['produk'], [
        'labels'            => ['name' => 'Kategori Produk', 'singular_name' => 'Kategori Produk'],
        'hierarchical'      => true,   // seperti Category, bukan Tag
        'public'            => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'rest_base'         => 'kategori-produk',
    ]);

    register_taxonomy('topik_faq', ['faq'], [
        'labels'            => ['name' => 'Topik FAQ', 'singular_name' => 'Topik FAQ'],
        'hierarchical'      => false,
        'public'            => true,
        'show_admin_column' => true,
        'show_in_rest'      => true,
        'rest_base'         => 'topik-faq',
    ]);
}

/* ═══════════════════════════════════════════════════════════════════
   3. Field kustom (ACF)
   ═══════════════════════════════════════════════════════════════════
   Nama field di sini adalah kontrak dengan frontend: `src/lib/wp.ts`
   membaca `acf.harga`, `acf.mata_uang`, `acf.embed_url`, dan seterusnya.
   Kalau nama di sini diubah, ubah juga di sana.

   `show_in_rest => 1` membuat ACF ikut menempel di respons REST sebagai
   objek `acf`. Untuk instalasi tanpa ACF, blok nomor 4 menyediakan
   penggantinya dari post meta biasa, dengan bentuk yang sama persis.
   ------------------------------------------------------------------- */

add_action('acf/init', 'headless_daftarkan_field_acf');

function headless_daftarkan_field_acf(): void
{
    if (!function_exists('acf_add_local_field_group')) {
        return;
    }

    acf_add_local_field_group([
        'key'                   => 'group_produk',
        'title'                 => 'Detail Produk',
        'show_in_rest'          => 1,
        'location'              => [[['param' => 'post_type', 'operator' => '==', 'value' => 'produk']]],
        'fields'                => [
            [
                'key'           => 'field_produk_harga',
                'label'         => 'Harga',
                'name'          => 'harga',
                'type'          => 'number',
                'required'      => 1,
                'min'           => 0,
                'instructions'  => 'Angka saja, tanpa titik atau "Rp". Contoh: 7500000',
            ],
            [
                'key'           => 'field_produk_mata_uang',
                'label'         => 'Mata uang',
                'name'          => 'mata_uang',
                'type'          => 'select',
                'choices'       => ['IDR' => 'IDR', 'USD' => 'USD', 'SGD' => 'SGD'],
                'default_value' => 'IDR',
            ],
            [
                'key'           => 'field_produk_stok',
                'label'         => 'Ketersediaan',
                'name'          => 'stok',
                'type'          => 'select',
                // Nilainya langsung memakai kosakata schema.org supaya tidak
                // perlu diterjemahkan lagi di frontend.
                'choices'       => [
                    'InStock'    => 'Tersedia',
                    'OutOfStock' => 'Habis',
                    'PreOrder'   => 'Pra-pesan',
                ],
                'default_value' => 'InStock',
            ],
            ['key' => 'field_produk_sku',   'label' => 'SKU',   'name' => 'sku',   'type' => 'text'],
            ['key' => 'field_produk_merek', 'label' => 'Merek', 'name' => 'merek', 'type' => 'text'],
            [
                'key'   => 'field_produk_rating_nilai',
                'label' => 'Rating (1–5)',
                'name'  => 'rating_nilai',
                'type'  => 'number',
                'min'   => 1,
                'max'   => 5,
                'step'  => 0.1,
                'instructions' => 'Kosongkan kalau belum ada ulasan. Rating karangan melanggar pedoman Google dan bisa membuat rich result dicabut.',
            ],
            [
                'key'   => 'field_produk_rating_jumlah',
                'label' => 'Jumlah ulasan',
                'name'  => 'rating_jumlah',
                'type'  => 'number',
                'min'   => 0,
            ],
        ],
    ]);

    acf_add_local_field_group([
        'key'          => 'group_video',
        'title'        => 'Detail Video',
        'show_in_rest' => 1,
        'location'     => [[['param' => 'post_type', 'operator' => '==', 'value' => 'video']]],
        'fields'       => [
            [
                'key'          => 'field_video_embed',
                'label'        => 'URL embed',
                'name'         => 'embed_url',
                'type'         => 'url',
                'required'     => 1,
                'instructions' => 'URL pemutar, bukan URL halaman. Contoh: https://www.youtube.com/embed/xxxx',
            ],
            [
                'key'          => 'field_video_thumbnail',
                'label'        => 'URL thumbnail',
                'name'         => 'thumbnail',
                'type'         => 'url',
                'instructions' => 'Kosongkan untuk memakai Featured Image.',
            ],
            [
                'key'          => 'field_video_durasi',
                'label'        => 'Durasi (ISO 8601)',
                'name'         => 'durasi_iso',
                'type'         => 'text',
                'placeholder'  => 'PT3M42S',
                'instructions' => 'Format schema.org: PT[jam]H[menit]M[detik]S.',
            ],
            [
                'key'   => 'field_video_tanggal',
                'label' => 'Tanggal unggah',
                'name'  => 'tanggal_unggah',
                'type'  => 'date_time_picker',
                'return_format' => 'Y-m-d\TH:i:s\Z',
            ],
        ],
    ]);

    acf_add_local_field_group([
        'key'          => 'group_faq',
        'title'        => 'Jawaban',
        'show_in_rest' => 1,
        'location'     => [[['param' => 'post_type', 'operator' => '==', 'value' => 'faq']]],
        'fields'       => [
            [
                'key'          => 'field_faq_jawaban',
                'label'        => 'Jawaban singkat',
                'name'         => 'jawaban',
                'type'         => 'textarea',
                'maxlength'    => 600,
                'instructions' => 'Satu paragraf, langsung menjawab. Isi inilah yang masuk ke structured data FAQPage.',
            ],
        ],
    ]);

    acf_add_local_field_group([
        'key'          => 'group_penulis',
        'title'        => 'Profil Penulis (schema Person)',
        'show_in_rest' => 1,
        'location'     => [[['param' => 'user_form', 'operator' => '==', 'value' => 'all']]],
        'fields'       => [
            ['key' => 'field_penulis_jabatan', 'label' => 'Jabatan', 'name' => 'jabatan', 'type' => 'text'],
            [
                'key'          => 'field_penulis_sameas',
                'label'        => 'Profil lain',
                'name'         => 'same_as',
                'type'         => 'textarea',
                'instructions' => 'Satu URL per baris (LinkedIn, GitHub, situs pribadi). Dipakai untuk properti sameAs pada schema Person.',
            ],
        ],
    ]);
}

/* ═══════════════════════════════════════════════════════════════════
   4. Pengganti ACF bila plugin-nya belum terpasang
   ═══════════════════════════════════════════════════════════════════
   Bentuk respons dijaga tetap sama (`acf: { ... }`) supaya frontend tidak
   perlu tahu instalasi ini memakai ACF atau tidak.
   ------------------------------------------------------------------- */

add_action('rest_api_init', 'headless_daftarkan_acf_cadangan');

function headless_daftarkan_acf_cadangan(): void
{
    if (function_exists('get_fields')) {
        return; // ACF sudah menyediakannya sendiri
    }

    $peta = [
        'produk' => ['harga', 'mata_uang', 'stok', 'sku', 'merek', 'rating_nilai', 'rating_jumlah'],
        'video'  => ['embed_url', 'thumbnail', 'durasi_iso', 'tanggal_unggah'],
        'faq'    => ['jawaban'],
    ];

    foreach ($peta as $tipe => $field) {
        register_rest_field($tipe, 'acf', [
            'get_callback' => static function (array $post) use ($field): array {
                $keluaran = [];
                foreach ($field as $nama) {
                    $nilai = get_post_meta($post['id'], $nama, true);
                    if ($nilai !== '') {
                        $keluaran[$nama] = $nilai;
                    }
                }
                return $keluaran;
            },
            'schema' => ['description' => 'Field kustom', 'type' => 'object'],
        ]);
    }
}

/* ═══════════════════════════════════════════════════════════════════
   5. Pratinjau draft — tombol "Preview" mengarah ke Next.js
   ═══════════════════════════════════════════════════════════════════
   Tautannya bertanda tangan. Next.js memeriksa rahasianya lebih dulu, baru
   menyalakan Draft Mode; tanpa itu, draft tidak pernah bisa dibaca dari luar.
   ------------------------------------------------------------------- */

add_filter('preview_post_link', 'headless_tautan_pratinjau', 10, 2);

function headless_tautan_pratinjau(string $tautan, WP_Post $post): string
{
    if (!headless_terkonfigurasi('NEXTJS_PREVIEW_SECRET') || !headless_terkonfigurasi('NEXTJS_SITE_URL')) {
        return $tautan; // belum dikonfigurasi — biarkan pratinjau bawaan WordPress
    }
    if (!in_array($post->post_type, HEADLESS_TIPE_KONTEN, true)) {
        return $tautan;
    }

    // Draft yang belum pernah disimpan belum punya post_name.
    $slug = $post->post_name !== '' ? $post->post_name : sanitize_title($post->post_title);
    if ($slug === '') {
        return $tautan;
    }

    return add_query_arg(
        [
            'secret' => rawurlencode(NEXTJS_PREVIEW_SECRET),
            'slug'   => rawurlencode($slug),
            'tipe'   => rawurlencode($post->post_type),
        ],
        rtrim(NEXTJS_SITE_URL, '/') . '/api/draft'
    );
}

/** Tautan "Lihat" pada konten yang sudah terbit juga diarahkan ke frontend. */
add_filter('post_type_link', 'headless_tautan_permanen', 10, 2);
add_filter('post_link', 'headless_tautan_permanen', 10, 2);

function headless_tautan_permanen(string $tautan, WP_Post $post): string
{
    // Hanya di dalam admin: di luar sana permalink dipakai WordPress sendiri
    // untuk hal-hal seperti feed dan canonical redirect.
    if (!is_admin() || !headless_terkonfigurasi('NEXTJS_SITE_URL') || $post->post_type !== 'post') {
        return $tautan;
    }
    return rtrim(NEXTJS_SITE_URL, '/') . '/artikel/' . $post->post_name;
}

/* ═══════════════════════════════════════════════════════════════════
   6. Webhook revalidasi
   ═══════════════════════════════════════════════════════════════════
   Setiap konten terbit atau berubah, Next.js diberi tahu tipe dan slug-nya.
   Yang disegarkan di sana hanya cache tag terkait — bukan seluruh situs, dan
   tanpa deploy ulang.
   ------------------------------------------------------------------- */

add_action('wp_after_insert_post', 'headless_kirim_webhook', 10, 4);

function headless_kirim_webhook(int $post_id, WP_Post $post, bool $update, $post_before): void
{
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }
    if (!in_array($post->post_type, HEADLESS_TIPE_KONTEN, true)) {
        return;
    }
    if (!headless_terkonfigurasi('NEXTJS_REVALIDATE_SECRET') || !headless_terkonfigurasi('NEXTJS_SITE_URL')) {
        return;
    }

    $sebelumnya = $post_before instanceof WP_Post ? $post_before->post_status : '';
    // Draft yang belum pernah terbit tidak mengubah apa pun di sisi publik.
    if ($post->post_status !== 'publish' && $sebelumnya !== 'publish') {
        return;
    }

    $respons = wp_remote_post(rtrim(NEXTJS_SITE_URL, '/') . '/api/revalidate', [
        'timeout'  => 8,
        'blocking' => false, // jangan menahan layar editor
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode([
            'secret' => NEXTJS_REVALIDATE_SECRET,
            'slug'   => $post->post_name,
            'tipe'   => $post->post_type,
        ]),
    ]);

    if (is_wp_error($respons)) {
        error_log('[headless] revalidasi gagal: ' . $respons->get_error_message());
    }
}

/** Hapus konten juga harus menyegarkan daftar, bukan cuma terbit. */
add_action('trashed_post', static function (int $post_id): void {
    $post = get_post($post_id);
    if ($post instanceof WP_Post) {
        headless_kirim_webhook($post_id, $post, true, $post);
    }
});

/* ═══════════════════════════════════════════════════════════════════
   7. Pengetatan keamanan
   ═══════════════════════════════════════════════════════════════════
   Pada pemasangan headless, WordPress tidak lagi melayani pengunjung — ia
   hanya melayani editor dan satu frontend. Karena itu permukaan seranganya
   bisa dipersempit jauh lebih agresif daripada situs WordPress biasa.
   ------------------------------------------------------------------- */

/* 7.1 — Berhenti mengumumkan versi WordPress. */
remove_action('wp_head', 'wp_generator');
add_filter('the_generator', '__return_empty_string');

add_filter('style_loader_src', 'headless_buang_versi', 9999);
add_filter('script_loader_src', 'headless_buang_versi', 9999);

function headless_buang_versi(string $src): string
{
    return strpos($src, 'ver=') !== false ? remove_query_arg('ver', $src) : $src;
}

/* 7.2 — XML-RPC: pintu lama yang jadi sasaran serangan tebak sandi massal. */
add_filter('xmlrpc_enabled', '__return_false');
add_filter('xmlrpc_methods', '__return_empty_array');
add_filter('wp_headers', static function (array $headers): array {
    unset($headers['X-Pingback']);
    return $headers;
});

/* 7.3 — Tutup enumerasi pengguna.
   Nama pengguna adalah separuh dari kredensial; tidak ada alasan
   membagikannya lewat REST API atau ?author=1. */
add_filter('rest_endpoints', static function (array $endpoints): array {
    if (is_user_logged_in()) {
        return $endpoints; // editor tetap butuh daftar penulis di admin
    }
    unset($endpoints['/wp/v2/users'], $endpoints['/wp/v2/users/(?P<id>[\d]+)']);
    return $endpoints;
});

add_action('template_redirect', static function (): void {
    if (!is_admin() && isset($_GET['author']) && !is_user_logged_in()) {
        wp_safe_redirect(home_url('/'), 301);
        exit;
    }
});

/* 7.4 — REST API: baca boleh publik (frontend memang butuh), tulis wajib
   terautentikasi. Draft dan revisi tetap tertutup karena WordPress sudah
   memeriksa kapabilitas per permintaan. */
add_filter('rest_authentication_errors', static function ($hasil) {
    if (!empty($hasil)) {
        return $hasil;
    }
    $metode = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($metode !== 'GET' && !is_user_logged_in()) {
        return new WP_Error('rest_tidak_diizinkan', 'Autentikasi diperlukan.', ['status' => 401]);
    }
    return $hasil;
});

/* 7.5 — Header keamanan HTTP. */
add_action('send_headers', static function (): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()');
    if (is_ssl()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
});

/* 7.6 — Halaman login tidak perlu memberi tahu bagian mana yang salah. */
add_filter('login_errors', static function (): string {
    return 'Kombinasi tersebut tidak dikenali.';
});

/* 7.7 — Matikan editor berkas tema/plugin dari dalam admin. Didefinisikan saat
   plugin dimuat, sebelum admin sempat memeriksanya. Lebih baik lagi: taruh
   `define('DISALLOW_FILE_EDIT', true)` langsung di wp-config.php. */
if (!defined('DISALLOW_FILE_EDIT')) {
    define('DISALLOW_FILE_EDIT', true);
}

/* 7.8 — Batasi pengunggahan tipe berkas yang bisa dieksekusi. */
add_filter('upload_mimes', static function (array $mimes): array {
    unset($mimes['exe'], $mimes['swf'], $mimes['php'], $mimes['phtml'], $mimes['htm|html']);
    return $mimes;
});

/* ═══════════════════════════════════════════════════════════════════
   8. Pembantu
   ═══════════════════════════════════════════════════════════════════ */

/** Konstanta dianggap terkonfigurasi hanya kalau benar-benar berisi. */
function headless_terkonfigurasi(string $nama): bool
{
    return defined($nama) && is_string(constant($nama)) && trim(constant($nama)) !== '';
}

/**
 * Peringatan di dashboard kalau konfigurasinya belum lengkap — supaya
 * kegagalan webhook tidak baru ketahuan berminggu-minggu kemudian.
 */
add_action('admin_notices', static function (): void {
    if (!current_user_can('manage_options')) {
        return;
    }
    $kurang = array_filter(
        ['NEXTJS_SITE_URL', 'NEXTJS_REVALIDATE_SECRET', 'NEXTJS_PREVIEW_SECRET'],
        static fn(string $nama): bool => !headless_terkonfigurasi($nama)
    );
    if ($kurang === []) {
        return;
    }
    printf(
        '<div class="notice notice-warning"><p><b>Headless Setup:</b> konstanta berikut belum diisi di wp-config.php — %s. Webhook revalidasi dan pratinjau draft belum aktif.</p></div>',
        esc_html(implode(', ', $kurang))
    );
});

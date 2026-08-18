<?php
/**
 * Dipasang di WordPress (functions.php tema child, atau plugin kecil sendiri).
 *
 * Setiap kali konten diterbitkan atau diperbarui, WordPress memanggil endpoint
 * revalidasi di Next.js. Yang disegarkan hanya tag yang berkaitan — bukan
 * seluruh situs, dan tanpa deploy ulang.
 *
 * Simpan URL dan rahasianya di wp-config.php, jangan di dalam kode:
 *   define('NEXTJS_REVALIDATE_URL', 'https://situs-anda.com/api/revalidate');
 *   define('NEXTJS_REVALIDATE_SECRET', 'string-acak-panjang');
 */
add_action('wp_after_insert_post', function ($post_id, $post, $update, $post_before) {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
        return;
    }
    if ($post->post_status !== 'publish' && (!$post_before || $post_before->post_status !== 'publish')) {
        return; // draft yang belum pernah terbit tidak perlu memicu revalidasi
    }

    $response = wp_remote_post(NEXTJS_REVALIDATE_URL, [
        'timeout'  => 8,
        'blocking' => false, // jangan menahan layar editor
        'headers'  => ['Content-Type' => 'application/json'],
        'body'     => wp_json_encode([
            'secret' => NEXTJS_REVALIDATE_SECRET,
            'slug'   => $post->post_name,
            'tipe'   => $post->post_type,
        ]),
    ]);

    if (is_wp_error($response)) {
        error_log('[revalidate] gagal: ' . $response->get_error_message());
    }
}, 10, 4);

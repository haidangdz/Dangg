<?php
// Lấy IP của người dùng
$visitor_ip = $_SERVER['REMOTE_ADDR'];

// Đường dẫn tới file lưu danh sách IP
$ip_file = 'visitor_ips.json';

// Kiểm tra nếu file chưa tồn tại, tạo mới
if (!file_exists($ip_file)) {
    file_put_contents($ip_file, json_encode([]));
}

// Đọc danh sách IP từ file
$ips = json_decode(file_get_contents($ip_file), true);

// Kiểm tra nếu IP chưa tồn tại, thêm vào danh sách
if (!in_array($visitor_ip, $ips)) {
    $ips[] = $visitor_ip;
    // Ghi lại danh sách IP mới vào file
    file_put_contents($ip_file, json_encode($ips));
}

// Đếm số lượng IP duy nhất
$visitor_count = count($ips);

// Trả về số lượng để hiển thị
echo $visitor_count;
?>
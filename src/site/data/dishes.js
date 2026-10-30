// Nội dung từng món trên website (ảnh, mô tả, định lượng). Giá và còn / hết lấy trực tiếp từ thực đơn trong app,
// ghép theo tên món (không phân biệt hoa thường, dấu). Món có trong app mà chưa có ở đây vẫn hiện, chỉ thiếu ảnh / mô tả.
//
// photo: đường dẫn ảnh trong public/site/photos (vd '/site/photos/banh-cuon.webp'); null = khung ảnh tạm
// portion: định lượng, để trống tới khi quán cho số thật (website chỉ hiện khi có)
export const CATEGORIES = [
  { id: 'rolls', en: 'Rice rolls & dumplings', vi: 'Bánh cuốn & bánh' },
  { id: 'gio-cha', en: 'Giò chả – Vietnamese pork rolls', vi: 'Giò chả' },
  { id: 'meats', en: 'Beef balls & sausages', vi: 'Bò viên & lạp xưởng' },
];

export const DISHES = [
  {
    match: 'Bánh cuốn',
    slug: 'banh-cuon',
    category: 'rolls',
    featured: true,
    photo: null,
    en: {
      name: 'Bánh cuốn – steamed rice rolls',
      short: 'Silky steamed rice sheets rolled around seasoned pork and wood ear mushroom.',
      description:
        'Bánh cuốn is made by spreading a thin rice batter over cloth stretched across a steaming pot, then rolling the delicate sheet around minced pork and wood ear mushroom. It is traditionally topped with crispy fried shallots and eaten with nước chấm, a light fish sauce dressing, and slices of giò lụa.',
      portion: '',
    },
    vi: {
      name: 'Bánh cuốn',
      short: 'Bánh tráng mỏng từ bột gạo, cuốn nhân thịt băm và mộc nhĩ.',
      description:
        'Bột gạo được tráng mỏng trên lớp khăn căng trên nồi hấp, rồi cuốn với nhân thịt heo băm và mộc nhĩ. Theo kiểu truyền thống, bánh cuốn rắc hành phi và ăn kèm nước chấm cùng giò lụa.',
      portion: '',
    },
  },
  {
    match: 'Giò Lụa',
    slug: 'gio-lua',
    category: 'gio-cha',
    featured: true,
    photo: null,
    en: {
      name: 'Giò lụa – Vietnamese pork roll',
      short: 'Smooth, springy pork roll wrapped in banana leaves.',
      description:
        'Giò lụa is lean pork pounded into a silky paste with fish sauce, wrapped tightly in banana leaves and boiled. Sliced thin, it is the classic partner for bánh cuốn, sticky rice or a bánh mì, and a must-have on the table at Tết.',
      portion: '',
    },
    vi: {
      name: 'Giò lụa',
      short: 'Giò lụa dai mịn, gói lá chuối.',
      description:
        'Thịt heo nạc giã nhuyễn với nước mắm, gói chặt trong lá chuối rồi luộc chín. Thái mỏng ăn với bánh cuốn, xôi, bánh mì, và không thể thiếu trong mâm cỗ ngày Tết.',
      portion: '',
    },
  },
  {
    match: 'Chả Bì',
    slug: 'cha-bi',
    category: 'gio-cha',
    photo: null,
    en: {
      name: 'Chả bì – pork roll with pork skin',
      short: 'Pork roll mixed with thin strips of pork skin for a chewy bite.',
      description:
        'Chả bì combines smooth pork paste with finely shredded pork skin, giving each slice a pleasant chewy texture. Enjoy it with rice rolls, broken rice or in a bánh mì.',
      portion: '',
    },
    vi: {
      name: 'Chả bì',
      short: 'Chả trộn bì heo thái sợi, giòn dai.',
      description: 'Giò sống trộn bì heo thái sợi mỏng, mỗi lát giòn dai. Ăn kèm bánh cuốn, cơm tấm hoặc kẹp bánh mì đều ngon.',
      portion: '',
    },
  },
  {
    match: 'Chả Chiên',
    slug: 'cha-chien',
    category: 'gio-cha',
    featured: true,
    photo: null,
    en: {
      name: 'Chả chiên – fried pork roll',
      short: 'Pork roll fried until golden on the outside and tender inside.',
      description:
        'Chả chiên starts with the same pork paste as giò lụa, shaped and fried so the outside turns golden and fragrant while the inside stays soft. Great sliced with bánh cuốn, noodles or steamed rice.',
      portion: '',
    },
    vi: {
      name: 'Chả chiên',
      short: 'Chả chiên vàng thơm bên ngoài, mềm bên trong.',
      description: 'Làm từ giò sống như giò lụa, nặn khuôn rồi chiên vàng thơm, bên trong vẫn mềm. Thái lát ăn với bánh cuốn, bún hoặc cơm.',
      portion: '',
    },
  },
  {
    match: 'Chả Bò',
    slug: 'cha-bo',
    category: 'gio-cha',
    photo: null,
    en: {
      name: 'Chả bò – beef roll',
      short: 'Firm beef roll seasoned with cracked black pepper.',
      description:
        'Chả bò is a beef version of the classic Vietnamese roll, seasoned generously with black pepper for a bold, savoury flavour. Slice and enjoy it on its own, with rice rolls or in a bánh mì.',
      portion: '',
    },
    vi: {
      name: 'Chả bò',
      short: 'Chả bò chắc thịt, thơm tiêu.',
      description: 'Chả làm từ thịt bò, nêm nhiều tiêu đen nên đậm vị. Thái lát ăn không, ăn với bánh cuốn hoặc kẹp bánh mì.',
      portion: '',
    },
  },
  {
    match: 'Giò Thủ',
    slug: 'gio-thu',
    category: 'gio-cha',
    photo: null,
    en: {
      name: 'Giò thủ – Vietnamese head cheese',
      short: 'Pressed pork with ear and wood ear mushroom, crunchy and savoury.',
      description:
        'Giò thủ is made from pork ear, pork and wood ear mushroom, seasoned with pepper and fish sauce, then pressed into a firm roll. Sliced cold, it has a satisfying crunch and is a favourite at Tết and family gatherings.',
      portion: '',
    },
    vi: {
      name: 'Giò thủ',
      short: 'Giò thủ giòn sần sật với tai heo, mộc nhĩ.',
      description: 'Tai heo, thịt heo và mộc nhĩ nêm tiêu, nước mắm, nén chặt thành cây giò. Thái lát ăn nguội giòn sần sật, món quen trong ngày Tết và đám tiệc.',
      portion: '',
    },
  },
  {
    match: 'Mọc, Giò Sống',
    slug: 'moc-gio-song',
    category: 'gio-cha',
    photo: null,
    en: {
      name: 'Mọc & giò sống – fresh pork paste',
      short: 'Seasoned raw pork paste, ready to cook into meatballs or fillings.',
      description:
        'Giò sống is the seasoned pork paste behind giò lụa and chả. Shape it into mọc meatballs for bún mọc or noodle soup, use it to stuff tofu, bitter melon or tomatoes, or fry it into your own chả at home. Keep refrigerated and cook thoroughly.',
      portion: '',
    },
    vi: {
      name: 'Mọc, giò sống',
      short: 'Giò sống đã nêm, về nặn mọc hoặc làm nhân.',
      description: 'Giò sống đã nêm sẵn, về nặn mọc nấu bún mọc, canh, nhồi đậu hũ, khổ qua, cà chua hoặc tự chiên chả. Giữ lạnh và nấu chín kỹ.',
      portion: '',
    },
  },
  {
    match: 'Bánh Giò',
    slug: 'banh-gio',
    category: 'rolls',
    featured: true,
    photo: null,
    en: {
      name: 'Bánh giò – pyramid rice dumpling',
      short: 'Soft rice dumpling wrapped in banana leaf with a savoury pork filling.',
      description:
        'Bánh giò is a pyramid-shaped dumpling made from rice flour, wrapped in banana leaves and steamed. Inside is a savoury filling of minced pork and wood ear mushroom. It is a popular Hanoi breakfast and makes an easy, filling snack.',
      portion: '',
    },
    vi: {
      name: 'Bánh giò',
      short: 'Bánh giò mềm, gói lá chuối, nhân thịt mộc nhĩ.',
      description: 'Bánh làm từ bột gạo, gói lá chuối hình chóp rồi hấp chín, nhân thịt băm và mộc nhĩ. Món ăn sáng quen thuộc của người Hà Nội, ăn no và tiện.',
      portion: '',
    },
  },
  {
    match: 'Xôi Khúc',
    slug: 'xoi-khuc',
    category: 'rolls',
    photo: null,
    en: {
      name: 'Xôi khúc – sticky rice cudweed dumpling',
      short: 'Green cudweed dumpling with mung bean and pork, rolled in sticky rice.',
      description:
        'Xôi khúc is a northern Vietnamese favourite: a soft dough made with rau khúc (cudweed) and rice flour is wrapped around mung bean and pork, then coated in glutinous rice and steamed. Fragrant, filling and best eaten warm.',
      portion: '',
    },
    vi: {
      name: 'Xôi khúc',
      short: 'Bánh khúc nhân đậu xanh thịt, lăn xôi.',
      description: 'Món quen của miền Bắc: vỏ làm từ rau khúc và bột gạo, bọc nhân đậu xanh, thịt, lăn gạo nếp rồi đồ chín. Thơm, no, ngon nhất khi ăn nóng.',
      portion: '',
    },
  },
  {
    match: 'Bò Viên',
    slug: 'bo-vien',
    category: 'meats',
    photo: null,
    en: {
      name: 'Bò viên – Vietnamese beef balls',
      short: 'Springy beef balls for phở, noodle soup or the grill.',
      description:
        'Bò viên are beef balls with the bouncy texture Vietnamese cooks love. Drop them into phở or any noodle soup, add them to hot pot, or grill and serve with hoisin and chilli sauce.',
      portion: '',
    },
    vi: {
      name: 'Bò viên',
      short: 'Bò viên dai giòn, nấu phở, hủ tiếu hoặc nướng.',
      description: 'Bò viên dai giòn đúng kiểu. Thả vào phở, hủ tiếu, lẩu hoặc nướng chấm tương đen, tương ớt.',
      portion: '',
    },
  },
  {
    match: 'Lạp Xưởng',
    slug: 'lap-xuong',
    category: 'meats',
    photo: null,
    en: {
      name: 'Lạp xưởng – sweet pork sausage',
      short: 'Sweet, savoury dried pork sausage for sticky rice and fried rice.',
      description:
        'Lạp xưởng is a dried pork sausage with a sweet and savoury flavour. Pan-fry or steam it and serve with sticky rice, slice it into fried rice, or add it to a claypot dish.',
      portion: '',
    },
    vi: {
      name: 'Lạp xưởng',
      short: 'Lạp xưởng ngọt thơm, ăn với xôi, cơm chiên.',
      description: 'Lạp xưởng heo phơi khô, vị ngọt mặn. Chiên hoặc hấp ăn với xôi, thái hạt lựu làm cơm chiên hoặc nấu cơm niêu.',
      portion: '',
    },
  },
];

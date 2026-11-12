// Nội dung từng món trên website (ảnh, mô tả, định lượng). Giá và còn / hết lấy từ thực đơn.
// Ghép theo id (UUID trong public_shop). Món mới chưa có id thì ghép theo slug / tên ở aliases.
//
// photo: đường dẫn ảnh trong public/site/photos; null = khung ảnh tạm (không dùng ảnh AI)
// portion: chỉ dùng khi thực đơn chưa có định lượng
//
// Bánh chưng / Bánh tét chưa có dòng trong thực đơn. Khi thêm, dùng đúng:
//   name: "Bánh chưng / Bánh tét"
//   price: 15
//   portion: "1 kg"   (hoặc "1kg" — trang tự thêm dấu cách)
//   available: true
// Trang ghép slug banh-chung-banh-tet. Cũng nhận tên "Bánh chưng" hoặc "Bánh tét".
// Chưa có ảnh thật: để trống, đừng thêm ảnh tạo bằng AI.
export const CATEGORIES = [
  { id: 'rolls', en: 'Rice rolls & dumplings', vi: 'Bánh cuốn & bánh' },
  { id: 'gio-cha', en: 'Giò chả – Vietnamese pork rolls', vi: 'Giò chả' },
  { id: 'meats', en: 'Beef balls & sausages', vi: 'Bò viên & lạp xưởng' },
];

export const DISHES = [
  {
    id: '027e9083-77c7-490c-b9f6-0732d1536f2b',
    slug: 'banh-cuon',
    category: 'rolls',
    featured: true,
    photo: '/site/photos/banh-cuon.webp',
    en: {
      name: 'Bánh cuốn – steamed rice rolls',
      short:
        'Steamed rice rolls with pork and wood ear mushroom, served with nước mắm (dipping fish sauce) and fried shallots.',
      description:
        'Bánh cuốn is made by spreading a thin rice batter over cloth stretched across a steaming pot, then rolling the delicate sheet around minced pork and wood ear mushroom. It is traditionally topped with crispy fried shallots and eaten with nước chấm (a light fish sauce dressing) and slices of giò lụa. Comes with nước mắm dipping sauce and fried shallots (hành phi).',
      alt: 'Bánh cuốn rice rolls topped with fried shallots and herbs, with slices of pork roll',
    },
    vi: {
      name: 'Bánh cuốn',
      short: 'Bánh tráng mỏng từ bột gạo, cuốn nhân thịt băm và mộc nhĩ.',
      description:
        'Bột gạo được tráng mỏng trên lớp khăn căng trên nồi hấp, rồi cuốn với nhân thịt heo băm và mộc nhĩ. Theo kiểu truyền thống, bánh cuốn rắc hành phi và ăn kèm nước chấm cùng giò lụa. Bánh kèm nước mắm và hành phi.',
    },
  },
  {
    id: '81b39c8b-ba8b-4b3a-a7f6-fc6b3ebe5caa',
    slug: 'gio-lua',
    category: 'gio-cha',
    featured: true,
    photo: '/site/photos/gio-lua.webp',
    en: {
      name: 'Giò lụa – Vietnamese pork roll',
      short: 'Smooth, springy pork roll wrapped in banana leaves.',
      description:
        'Giò lụa is lean pork pounded into a silky paste with fish sauce, wrapped tightly in banana leaves and boiled. Sliced thin, it is the classic partner for bánh cuốn, sticky rice or a bánh mì, and a must-have at Tết (Lunar New Year).',
      alt: 'Sliced giò lụa pork roll beside whole rolls wrapped in banana leaf',
    },
    vi: {
      name: 'Giò lụa',
      short: 'Giò lụa dai mịn, gói lá chuối.',
      description:
        'Thịt heo nạc giã nhuyễn với nước mắm, gói chặt trong lá chuối rồi luộc chín. Thái mỏng ăn với bánh cuốn, xôi, bánh mì, và không thể thiếu trong mâm cỗ ngày Tết.',
    },
  },
  {
    id: 'b936f45b-0da1-49b8-9433-0df45382dc8d',
    slug: 'cha-bi',
    category: 'gio-cha',
    photo: '/site/photos/cha-bi.webp',
    en: {
      alt: 'Chả bì pork roll with pork skin, whole and sliced on a plate with fresh cilantro and a small bowl of chilli fish sauce',
      name: 'Chả bì – pork roll with pork skin',
      short: 'Pork roll mixed with thin strips of pork skin for a chewy bite.',
      description:
        'Chả bì combines smooth pork paste with finely shredded pork skin, giving each slice a pleasant chewy texture. Enjoy it with bánh cuốn, broken rice (cơm tấm) or in a bánh mì.',
    },
    vi: {
      name: 'Chả bì',
      short: 'Chả trộn bì heo thái sợi, giòn dai.',
      description: 'Giò sống trộn bì heo thái sợi mỏng, mỗi lát giòn dai. Ăn kèm bánh cuốn, cơm tấm hoặc kẹp bánh mì đều ngon.',
    },
  },
  {
    id: '6b451196-1e24-44cb-a8ea-ce8fdf917b77',
    slug: 'cha-chien',
    category: 'gio-cha',
    featured: true,
    photo: null,
    en: {
      name: 'Chả chiên – fried pork roll',
      short: 'Pork roll fried until golden on the outside and tender inside.',
      description:
        'Chả chiên starts with the same pork paste as giò lụa, shaped and fried so the outside turns golden and fragrant while the inside stays soft. Great sliced with bánh cuốn, noodles or steamed rice.',
    },
    vi: {
      name: 'Chả chiên',
      short: 'Chả chiên vàng thơm bên ngoài, mềm bên trong.',
      description: 'Làm từ giò sống như giò lụa, nặn khuôn rồi chiên vàng thơm, bên trong vẫn mềm. Thái lát ăn với bánh cuốn, bún hoặc cơm.',
    },
  },
  {
    id: 'ea92f18d-76e7-42f0-adc6-16edd333870c',
    slug: 'cha-bo',
    category: 'gio-cha',
    photo: '/site/photos/cha-bo.webp',
    en: {
      name: 'Chả bò – Vietnamese beef roll',
      short: 'Firm Vietnamese beef roll seasoned with garlic and black pepper.',
      description:
        'Chả bò is a Vietnamese beef roll made with beef, garlic and black pepper.',
      alt: 'Thick slices of chả bò Vietnamese beef roll on a wooden board',
    },
    vi: {
      name: 'Chả bò',
      short: 'Chả bò chắc thịt, thơm tiêu.',
      description: 'Chả làm từ thịt bò, nêm nhiều tiêu đen nên đậm vị. Thái lát ăn không, ăn với bánh cuốn hoặc kẹp bánh mì.',
    },
  },
  {
    id: '2a3af5c2-582d-4564-8a13-022176a21fd9',
    slug: 'gio-thu',
    category: 'gio-cha',
    photo: null,
    en: {
      name: 'Giò thủ – Vietnamese head cheese',
      short: 'Pork, pork ear, pork tongue, wood ear mushroom and black pepper.',
      description:
        'Giò thủ is made from pork, pork ear, pork tongue and wood ear mushroom, seasoned with black pepper and pressed into a firm roll. Sliced cold, it has a satisfying crunch and is a favourite at Tết (Lunar New Year) and family gatherings.',
    },
    vi: {
      name: 'Giò thủ',
      short: 'Giò thủ giòn sần sật với tai heo, mộc nhĩ.',
      description: 'Tai heo, thịt heo và mộc nhĩ nêm tiêu, nước mắm, nén chặt thành cây giò. Thái lát ăn nguội giòn sần sật, món quen trong ngày Tết và đám tiệc.',
    },
  },
  {
    id: '9aa9f3dc-bc0a-40ab-917c-d4917973bd35',
    slug: 'moc-gio-song',
    category: 'gio-cha',
    photo: null,
    en: {
      name: 'Giò sống & mọc – raw seasoned pork paste',
      title: 'Giò sống & mọc (raw pork paste)',
      short: 'Raw seasoned pork paste – keep chilled and cook before eating. Shape into meatballs (mọc) or use as a filling.',
      description:
        'Giò sống is the seasoned pork paste behind giò lụa and chả. Shape it into mọc meatballs for bún mọc or noodle soup, use it to stuff tofu, bitter melon or tomatoes, or fry it into your own chả at home. Sold raw. Keep refrigerated and cook thoroughly before eating.',
    },
    vi: {
      name: 'Giò sống & mọc',
      short: 'Giò sống đã nêm, về nặn mọc hoặc làm nhân.',
      description:
        'Giò sống đã nêm sẵn, về nặn mọc nấu bún mọc, canh, nhồi đậu hũ, khổ qua, cà chua hoặc tự chiên chả. Bán sống, giữ lạnh và nấu chín trước khi ăn.',
    },
  },
  {
    id: 'a4e97534-4e8b-4725-a87a-114b5704a748',
    slug: 'banh-gio',
    category: 'rolls',
    featured: true,
    photo: '/site/photos/banh-gio.webp',
    en: {
      name: 'Bánh giò – pyramid rice dumpling',
      short: 'Soft rice dumpling wrapped in banana leaf with a savoury pork filling.',
      description:
        'Bánh giò is a pyramid-shaped dumpling made from rice flour, wrapped in banana leaves and steamed. Inside is a savoury filling of minced pork and wood ear mushroom. It is a popular Hanoi breakfast and makes an easy, filling snack.',
      alt: 'Bánh giò rice dumpling cut open on a banana leaf, showing the pork filling',
    },
    vi: {
      name: 'Bánh giò',
      short: 'Bánh giò mềm, gói lá chuối, nhân thịt mộc nhĩ.',
      description: 'Bánh làm từ bột gạo, gói lá chuối hình chóp rồi hấp chín, nhân thịt băm và mộc nhĩ. Món ăn sáng quen thuộc của người Hà Nội, ăn no và tiện.',
    },
  },
  {
    id: 'd0fa8b4b-dd29-4faf-9a8a-3ed172fffe15',
    slug: 'xoi-khuc',
    category: 'rolls',
    photo: null,
    en: {
      name: 'Xôi khúc – sticky rice cudweed dumpling',
      title: 'Xôi khúc (sticky rice dumpling)',
      short: 'Sticky rice ball with a mung bean and pork filling. Sold per piece.',
      description:
        'Xôi khúc is a northern Vietnamese favourite: a soft dough made with rau khúc (cudweed) and rice flour is wrapped around a mung bean and pork filling, then coated in sticky rice and steamed. Sold by the piece. Fragrant and filling, and best eaten warm.',
      portion: '1 piece',
    },
    vi: {
      name: 'Xôi khúc',
      short: 'Bánh khúc nhân đậu xanh thịt, lăn xôi.',
      description: 'Món quen của miền Bắc: vỏ làm từ rau khúc và bột gạo, bọc nhân đậu xanh, thịt, lăn gạo nếp rồi đồ chín. Thơm, no, ngon nhất khi ăn nóng.',
    },
  },
  {
    id: '0299b069-25d8-468d-96c9-34b99ebc9b77',
    slug: 'bo-vien',
    category: 'meats',
    photo: null,
    en: {
      name: 'Bò viên – Vietnamese beef balls',
      short: 'Springy, fully cooked beef balls for phở, noodle soup or the grill.',
      description:
        'Bò viên are beef balls with the bouncy texture Vietnamese cooks love. Drop them into phở or any noodle soup, add them to hot pot, or grill and serve with hoisin and chilli sauce. Fully cooked and sold chilled – just heat through.',
    },
    vi: {
      name: 'Bò viên',
      short: 'Bò viên dai giòn, nấu phở, hủ tiếu hoặc nướng.',
      description: 'Bò viên dai giòn đúng kiểu. Thả vào phở, hủ tiếu, lẩu hoặc nướng chấm tương đen, tương ớt. Đã chín, bán lạnh, chỉ cần hâm nóng.',
    },
  },
  {
    id: 'ee20db3b-a5b6-4cca-813e-5d84dc4a80d2',
    slug: 'lap-xuong',
    category: 'meats',
    photo: '/site/photos/lap-xuong.webp',
    en: {
      name: 'Lạp xưởng – sweet pork sausage',
      short: 'Sweet, savoury pork sausage – best pan-fried or grilled. Great with sticky rice or fried rice.',
      description:
        "Lạp xưởng is a Vietnamese pork sausage, air-dried for 24 hours. It's already cooked, but tastes best pan-fried or grilled before eating.",
      alt: 'Lạp xưởng sausages tied with string, with a small bowl of chilli sauce',
    },
    vi: {
      name: 'Lạp xưởng',
      short: 'Lạp xưởng ngọt thơm, ăn với xôi, cơm chiên.',
      description:
        'Lạp xưởng heo phơi khô, vị ngọt mặn. Đã chín, nên chiên hoặc nướng lại trước khi ăn. Ăn với xôi, thái hạt lựu làm cơm chiên hoặc nấu cơm niêu.',
    },
  },
  {
    // Chưa có UUID. Hiện khi thực đơn có dòng khớp slug hoặc aliases.
    id: null,
    slug: 'banh-chung-banh-tet',
    aliases: ['Bánh chưng / Bánh tét', 'Bánh chưng', 'Bánh tét'],
    // Thực đơn có 2 dòng riêng (Bánh Chưng, Bánh Tét) dùng chung nội dung này: mỗi món lấy mô tả riêng ở đây (khoá = slug của tên món)
    variants: {
      'banh-chung': {
        en: {
          short: 'The square one: glutinous rice, mung bean and pork in a tight square parcel, boiled for hours. A Northern-style Tết classic.',
          description:
            'Bánh chưng is the square sticky rice cake. Glutinous rice, creamy mung bean and seasoned pork are wrapped into a firm square parcel, traditionally in green leaves, and boiled for many hours. It is the classic Tết cake of Northern Vietnam. Not sure which to pick? Bánh chưng is square and is cut into wedges; bánh tét is a long round log cut into rounds.',
        },
        vi: {
          short: 'Bánh hình vuông: gạo nếp, đậu xanh và thịt, luộc nhiều giờ. Bánh Tết kiểu miền Bắc.',
          description:
            'Bánh chưng có hình vuông. Gạo nếp, đậu xanh và thịt được gói chặt thành khối vuông, theo truyền thống gói bằng lá, luộc nhiều giờ. Đây là bánh Tết quen thuộc của miền Bắc. Cách phân biệt: bánh chưng hình vuông, cắt thành miếng; bánh tét hình trụ dài, cắt thành khoanh tròn.',
        },
      },
      'banh-tet': {
        en: {
          short: 'The long round log: glutinous rice, mung bean and pork, boiled for hours and sliced into rounds. A Southern-style Tết classic.',
          description:
            'Bánh tét is the long cylindrical sticky rice cake. Glutinous rice, mung bean and seasoned pork are rolled into a log, traditionally in banana leaves, and boiled for many hours, then sliced into neat rounds to serve. It is the classic Tết cake of Southern and Central Vietnam. Not sure which to pick? Bánh tét is a long round log cut into rounds; bánh chưng is square and is cut into wedges.',
        },
        vi: {
          short: 'Bánh hình trụ dài: gạo nếp, đậu xanh và thịt, luộc nhiều giờ, cắt thành khoanh tròn. Bánh Tết kiểu miền Nam.',
          description:
            'Bánh tét có hình trụ dài. Gạo nếp, đậu xanh và thịt được cuốn thành khúc, theo truyền thống gói bằng lá chuối, luộc nhiều giờ rồi cắt thành khoanh tròn khi ăn. Đây là bánh Tết quen thuộc của miền Nam và miền Trung. Cách phân biệt: bánh tét hình trụ dài, cắt thành khoanh tròn; bánh chưng hình vuông, cắt thành miếng.',
        },
      },
    },
    category: 'rolls',
    photo: null,
    en: {
      name: 'Bánh chưng / Bánh tét – Vietnamese sticky rice cake',
      title: 'Bánh chưng (sticky rice cake)',
      short: 'Glutinous rice wrapped around mung bean and pork, then boiled for hours. A must-have for Tết (Lunar New Year).',
      description:
        'Glutinous rice wrapped around mung bean and pork, then boiled for hours. A must-have for Tết (Lunar New Year).',
      portion: '1 kg',
    },
    vi: {
      name: 'Bánh chưng / Bánh tét',
      short: 'Gạo nếp, đậu xanh và thịt, luộc nhiều giờ. Món Tết.',
      description: 'Gạo nếp gói nhân đậu xanh và thịt, luộc nhiều giờ. Món không thể thiếu ngày Tết.',
      portion: '1 kg',
    },
  },
];

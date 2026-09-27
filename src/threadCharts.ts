// Factory thread charts (Brother PEC, Janome JEF), from pystitch via bastidor (MIT).
// [hex, name, catalog number]

export type ThreadEntry = [string, string, string];

export const THREAD_CHARTS: Record<string, ThreadEntry[]> = {
  Brother: [["#0e1f7c","Prussian Blue","1"],["#0a55a3","Blue","2"],["#008777","Teal Green","3"],["#4b6baf","Cornflower Blue","4"],["#ed171f","Red","5"],["#d15c00","Reddish Brown","6"],["#913697","Magenta","7"],["#e49acb","Light Lilac","8"],["#915fac","Lilac","9"],["#9ed67d","Mint Green","10"],["#e8a900","Deep Gold","11"],["#feba35","Orange","12"],["#ffff00","Yellow","13"],["#70bc1f","Lime Green","14"],["#ba9800","Brass","15"],["#a8a8a8","Silver","16"],["#7d6f00","Russet Brown","17"],["#ffffb3","Cream Brown","18"],["#4f5556","Pewter","19"],["#000000","Black","20"],["#0b3d91","Ultramarine","21"],["#770176","Royal Purple","22"],["#293133","Dark Gray","23"],["#2a1301","Dark Brown","24"],["#f64a8a","Deep Rose","25"],["#b27624","Light Brown","26"],["#fcbbc5","Salmon Pink","27"],["#fe370f","Vermilion","28"],["#f0f0f0","White","29"],["#6a1c8a","Violet","30"],["#a8ddc4","Seacrest","31"],["#2584bb","Sky Blue","32"],["#feb343","Pumpkin","33"],["#fff36b","Cream Yellow","34"],["#d0a660","Khaki","35"],["#d15400","Clay Brown","36"],["#66ba49","Leaf Green","37"],["#134a46","Peacock Blue","38"],["#878787","Gray","39"],["#d8ccc6","Warm Gray","40"],["#435607","Dark Olive","41"],["#fdd9de","Flesh Pink","42"],["#f993bc","Pink","43"],["#003822","Deep Green","44"],["#b2afd4","Lavender","45"],["#686ab0","Wisteria Violet","46"],["#efe3b9","Beige","47"],["#f73866","Carmine","48"],["#b54b64","Amber Red","49"],["#132b1a","Olive Green","50"],["#c70156","Dark Fuchsia","51"],["#fe9e32","Tangerine","52"],["#a8deeb","Light Blue","53"],["#00673e","Emerald Green","54"],["#4e2990","Purple","55"],["#2f7e20","Moss Green","56"],["#ffcccc","Flesh Pink","57"],["#ffd911","Harvest Gold","58"],["#095ba6","Electric Blue","59"],["#f0f970","Lemon Yellow","60"],["#e3f35b","Fresh Green","61"],["#ff9900","Orange","62"],["#fff08d","Cream Yellow","63"],["#ffc8c8","Applique","64"]],
  Janome: [["#000000","Black","002"],["#ffffff","White","001"],["#ffff17","Yellow","204"],["#ff6600","Orange","203"],["#2f5933","Olive Green","219"],["#237336","Green","226"],["#65c2c8","Sky","217"],["#ab5a96","Purple","208"],["#f669a0","Pink","201"],["#ff0000","Red","225"],["#b1704e","Brown","214"],["#0b2f84","Blue","207"],["#e4c35d","Gold","003"],["#481a05","Dark Brown","205"],["#ac9cc7","Pale Violet","209"],["#fcf294","Pale Yellow","210"],["#f999b7","Pale Pink","211"],["#fab381","Peach","212"],["#c9a480","Beige","213"],["#970533","Wine Red","215"],["#a0b8cc","Pale Sky","216"],["#7fc21c","Yellow Green","218"],["#e5e5e5","Silver Gray","220"],["#889b9b","Gray","221"],["#98d6bd","Pale Aqua","227"],["#b2e1e3","Baby Blue","228"],["#368ba0","Powder Blue","229"],["#4f83ab","Bright Blue","230"],["#386a91","Slate Blue","231"],["#071650","Navy Blue","232"],["#f999a2","Salmon Pink","233"],["#f9676b","Coral","234"],["#e3311f","Burnt Orange","235"],["#e2a188","Cinnamon","236"],["#b59474","Umber","237"],["#e4cf99","Blond","238"],["#ffcb00","Sunflower","239"],["#e1add4","Orchid Pink","240"],["#c3007e","Peony Purple","241"],["#80004b","Burgundy","242"],["#540571","Royal Purple","243"],["#b10525","Cardinal Red","244"],["#cae0c0","Opal Green","245"],["#899856","Moss Green","246"],["#5c941a","Meadow Green","247"],["#003114","Dark Green","248"],["#5dae94","Aquamarine","249"],["#4cbf8f","Emerald Green","250"],["#007772","Peacock Green","251"],["#595b61","Dark Gray","252"],["#fffff2","Ivory White","253"],["#b15818","Hazel","254"],["#cb8a07","Toast","255"],["#986c80","Salmon","256"],["#98692d","Cocoa Brown","257"],["#4d3419","Sienna","258"],["#4c330b","Sepia","259"],["#33200a","Dark Sepia","260"],["#523a97","Violet Blue","261"],["#0d217e","Blue Ink","262"],["#1e77ac","Sola Blue","263"],["#b2dd53","Green Dust","264"],["#f33689","Crimson","265"],["#de649e","Floral Pink","266"],["#984161","Wine","267"],["#4c5612","Olive Drab","268"],["#4c881f","Meadow","269"],["#e4de79","Mustard","270"],["#cb8a1a","Yellow Ocher","271"],["#cba21c","Old Gold","272"],["#ff9805","Honey Dew","273"],["#fcb257","Tangerine","274"],["#ffe505","Canary Yellow","275"],["#f0331f","Vermilion","202"],["#1a842d","Bright Green","206"],["#386cae","Ocean Blue","222"],["#e3c4b4","Beige Gray","223"],["#e3ac81","Bamboo","224"]],
};

/** Red-mean colour distance (compuphase), as used by pystitch for thread matching. */
function redMean(a: string, b: string): number {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const r1 = x >> 16, g1 = (x >> 8) & 255, b1 = x & 255;
  const r2 = y >> 16, g2 = (y >> 8) & 255, b2 = y & 255;
  const rm = (r1 + r2) >> 1;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
}

export function nearestThread(hex: string, chart: string): ThreadEntry | null {
  const list = THREAD_CHARTS[chart];
  if (!list) return null;
  let best = list[0], bd = Infinity;
  for (const t of list) {
    const d = redMean(hex, t[0]);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

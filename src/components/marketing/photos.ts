// Photography for the marketing pages.
//
// Sourced through the existing `searchUnsplashPhotos` cloud function and
// baked in as constants rather than fetched at runtime: the spec calls for
// caching server-side and never calling Unsplash per page view, and these
// pages are statically prerendered. To refresh, re-run the search and
// replace the entries below.
//
// Each subject holds several photos, ranked best-first, because no photo
// may appear twice on a page — several calendars often share a theme, and
// the same dinner table repeated down a grid reads as clip art.
// `assignCoverPhotos` does the allocating.

export interface Photo {
  url: string;
  alt: string;
  credit: string;
  creditUrl: string;
}

/** Subject library, each ranked best-first. */
export const SUBJECTS = {
  dinner: [
    {
      url: "https://images.unsplash.com/photo-1621112904887-419379ce6824?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZGlubmVyJTIwcGFydHl8ZW58MHwwfHx8MTc4ODQxMTYzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "A group of people at an outdoor dinner party with an oud on blankets",
      credit: "Considerate Agency",
      creditUrl: "https://unsplash.com/@considerateagency",
    },
    {
      url: "https://images.unsplash.com/photo-1699730148132-1409a3728479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxmcmllbmRzJTIwZGlubmVyJTIwcGFydHl8ZW58MHwwfHx8MTc4ODQxMTYzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "a group of people sitting around a table with food and drinks",
      credit: "OurWhisky Foundation",
      creditUrl: "https://unsplash.com/@ourwhiskyfoundation",
    },
    {
      url: "https://images.unsplash.com/photo-1699730148440-22fc68a96752?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxmcmllbmRzJTIwZGlubmVyJTIwcGFydHl8ZW58MHwwfHx8MTc4ODQxMTYzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "a group of people sitting around a table with food and drinks",
      credit: "OurWhisky Foundation",
      creditUrl: "https://unsplash.com/@ourwhiskyfoundation",
    },
    {
      url: "https://images.unsplash.com/photo-1621112904939-e259ddb99cff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxmcmllbmRzJTIwZGlubmVyJTIwcGFydHl8ZW58MHwwfHx8MTc4ODQxMTYzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "people sitting on red swing during night time",
      credit: "Considerate Agency",
      creditUrl: "https://unsplash.com/@considerateagency",
    },
  ],
  run: [
    {
      url: "https://images.unsplash.com/photo-1607962837359-5e7e89f86776?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxydW4lMjBjbHVifGVufDB8MHx8fDE3ODg0MTE0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "man in black t-shirt and black shorts running on road during daytime",
      credit: "Gabin Vallet",
      creditUrl: "https://unsplash.com/@gabinvallet",
    },
    {
      url: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxydW4lMjBjbHVifGVufDB8MHx8fDE3ODg0MTE0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "silhouette of three women running on grey concrete road",
      credit: "Fitsum Admasu",
      creditUrl: "https://unsplash.com/@fitmasu",
    },
    {
      url: "https://images.unsplash.com/photo-1590333748338-d629e4564ad9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxydW4lMjBjbHVifGVufDB8MHx8fDE3ODg0MTE0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "people running on gray asphalt road during daytime",
      credit: "Miguel A Amutio",
      creditUrl: "https://unsplash.com/@amutiomi",
    },
    {
      url: "https://images.unsplash.com/photo-1502904550040-7534597429ae?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxydW4lMjBjbHVifGVufDB8MHx8fDE3ODg0MTE0ODV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "group of people running on stadium",
      credit: "Steven Lelham",
      creditUrl: "https://unsplash.com/@slelham",
    },
  ],
  yoga: [
    {
      url: "https://images.unsplash.com/photo-1588286840104-8957b019727f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHx5b2dhJTIwY2xhc3N8ZW58MHwwfHx8MTc4ODQxMTUxMHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "woman in white tank top and pink leggings doing yoga",
      credit: "Dylan Gillis",
      creditUrl: "https://unsplash.com/@mainermedia",
    },
    {
      url: "https://images.unsplash.com/photo-1552196563-55cd4e45efb3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHx5b2dhJTIwY2xhc3N8ZW58MHwwfHx8MTc4ODQxMTUxMHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "woman performing yoga",
      credit: "Dane Wetton",
      creditUrl: "https://unsplash.com/@danewett",
    },
    {
      url: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHx5b2dhJTIwY2xhc3N8ZW58MHwwfHx8MTc4ODQxMTUxMHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "silhouette photography of woman doing yoga",
      credit: "kike vega",
      creditUrl: "https://unsplash.com/@kikekiks",
    },
    {
      url: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHx5b2dhJTIwY2xhc3N8ZW58MHwwfHx8MTc4ODQxMTUxMHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "woman in black tank top and black pants bending her body on floor",
      credit: "Ginny Rose Stewart",
      creditUrl: "https://unsplash.com/@ginnyrose",
    },
  ],
  family: [
    {
      url: "https://images.unsplash.com/photo-1599376672737-bd66af54c8f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxraWRzJTIwcGxheWdyb3VuZHxlbnwwfDB8fHwxNzg4NDExNTE4fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "2 boys sitting on red and black ride on toy car",
      credit: "Alexandr Podvalny",
      creditUrl: "https://unsplash.com/@freestockpro",
    },
    {
      url: "https://images.unsplash.com/photo-1460788150444-d9dc07fa9dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxraWRzJTIwcGxheWdyb3VuZHxlbnwwfDB8fHwxNzg4NDExNTE4fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "boy sitting on swing chair",
      credit: "Myles Tan",
      creditUrl: "https://unsplash.com/@mylestan",
    },
    {
      url: "https://images.unsplash.com/photo-1596997000103-e597b3ca50df?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxraWRzJTIwcGxheWdyb3VuZHxlbnwwfDB8fHwxNzg4NDExNTE4fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "brown wooden playground surrounded by green trees during daytime",
      credit: "Oakville Dude",
      creditUrl: "https://unsplash.com/@oakvilledude",
    },
    {
      url: "https://images.unsplash.com/photo-1594608661623-aa0bd3a69d98?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxraWRzJTIwcGxheWdyb3VuZHxlbnwwfDB8fHwxNzg4NDExNTE4fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "group of people wearing white and orange backpacks walking on gray concrete pavement during daytime",
      credit: "note thanun",
      creditUrl: "https://unsplash.com/@notethanun",
    },
  ],
  skate: [
    {
      url: "https://images.unsplash.com/photo-1496886077455-6e206da90837?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxza2F0ZXBhcmt8ZW58MHwwfHx8MTc4ODQxMTUyOXww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "man doing trick at skateboard park during sunset",
      credit: "Robson Hatsukami Morgan",
      creditUrl: "https://unsplash.com/@robsonhmorgan",
    },
    {
      url: "https://images.unsplash.com/photo-1534531304203-b830551771b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxza2F0ZXBhcmt8ZW58MHwwfHx8MTc4ODQxMTUyOXww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "time-lapse photo of man riding skateboard at skate park",
      credit: "Josh Hild",
      creditUrl: "https://unsplash.com/@joshhild",
    },
    {
      url: "https://images.unsplash.com/photo-1582486759052-fb6b5c90fa50?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxza2F0ZXBhcmt8ZW58MHwwfHx8MTc4ODQxMTUyOXww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "a group of skateboard ramps covered in graffiti",
      credit: "ALEXANDRE LALLEMAND",
      creditUrl: "https://unsplash.com/@alexandrelallemand",
    },
    {
      url: "https://images.unsplash.com/photo-1550602081-cfc32634c9bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxza2F0ZXBhcmt8ZW58MHwwfHx8MTc4ODQxMTUyOXww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "gray concrete skate park near bridge",
      credit: "David Libeert",
      creditUrl: "https://unsplash.com/@deefbelgium",
    },
  ],
  books: [
    {
      url: "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxib29rJTIwY2x1YnxlbnwwfDB8fHwxNzg4NDExNTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "person picking white and red book on bookshelf",
      credit: "Christin Hume",
      creditUrl: "https://unsplash.com/@christinhumephoto",
    },
    {
      url: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxib29rJTIwY2x1YnxlbnwwfDB8fHwxNzg4NDExNTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "person holding book sitting on brown surface",
      credit: "Blaz Photo",
      creditUrl: "https://unsplash.com/@blazphoto",
    },
    {
      url: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxib29rJTIwY2x1YnxlbnwwfDB8fHwxNzg4NDExNTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "book lot on table",
      credit: "Tom Hermans",
      creditUrl: "https://unsplash.com/@tomhermans",
    },
    {
      url: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxib29rJTIwY2x1YnxlbnwwfDB8fHwxNzg4NDExNTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "open book lot",
      credit: "Patrick Tomasso",
      creditUrl: "https://unsplash.com/@impatrickt",
    },
  ],
  cycling: [
    {
      url: "https://images.unsplash.com/photo-1631276893368-554b60393efb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxjeWNsaW5nfGVufDB8MHx8fDE3ODg0MTE2MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "man in brown t-shirt riding on bicycle on road during daytime",
      credit: "David Dvořáček",
      creditUrl: "https://unsplash.com/@dafidvor",
    },
    {
      url: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxjeWNsaW5nfGVufDB8MHx8fDE3ODg0MTE2MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "man and woman riding road bikes at the road near shore",
      credit: "Coen van de Broek",
      creditUrl: "https://unsplash.com/@ocen",
    },
    {
      url: "https://images.unsplash.com/photo-1517649763962-0c623066013b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxjeWNsaW5nfGVufDB8MHx8fDE3ODg0MTE2MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "group of cyclist on asphalt road",
      credit: "Markus Spiske",
      creditUrl: "https://unsplash.com/@markusspiske",
    },
    {
      url: "https://images.unsplash.com/photo-1452573992436-6d508f200b30?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxjeWNsaW5nfGVufDB8MHx8fDE3ODg0MTE2MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "two persons riding on bicycles",
      credit: "Maico Amorim",
      creditUrl: "https://unsplash.com/@maicoamorim",
    },
  ],
  drinks: [
    {
      url: "https://images.unsplash.com/photo-1580929753530-ef52238116c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHx3aW5lJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE1NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "wine bottle on brown wooden table",
      credit: "🇸🇮 Janko Ferlič",
      creditUrl: "https://unsplash.com/@itfeelslikefilm",
    },
    {
      url: "https://images.unsplash.com/photo-1543007631-283050bb3e8c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHx3aW5lJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE1NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "empty chairs and tables inside lighte room",
      credit: "qui nguyen",
      creditUrl: "https://unsplash.com/@quinguyen",
    },
    {
      url: "https://images.unsplash.com/photo-1597290282695-edc43d0e7129?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHx3aW5lJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE1NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "brown wooden shelf with bottles",
      credit: "Edgar Chaparro",
      creditUrl: "https://unsplash.com/@echaparro",
    },
    {
      url: "https://images.unsplash.com/photo-1575184560884-5f3ece6e636c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHx3aW5lJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE1NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "near empty wineglass",
      credit: "Aleksandr Popov",
      creditUrl: "https://unsplash.com/@5tep5",
    },
  ],
  rooftop: [
    {
      url: "https://images.unsplash.com/photo-1621275471769-e6aa344546d5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxyb29mdG9wJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "brown wooden table and chairs set",
      credit: "Brands&People",
      creditUrl: "https://unsplash.com/@brandsandpeople",
    },
    {
      url: "https://images.unsplash.com/photo-1493246318656-5bfd4cfb29b8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "patio set in terrace overlooking city",
      credit: "garrett parker",
      creditUrl: "https://unsplash.com/@garrettpsystems",
    },
    {
      url: "https://images.unsplash.com/photo-1556911899-5df3026220fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxyb29mdG9wJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "pile of clear footed wine glass lot",
      credit: "Adrien Olichon",
      creditUrl: "https://unsplash.com/@adrienolichon",
    },
    {
      url: "https://images.unsplash.com/photo-1622758235004-51977c5863f5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxyb29mdG9wJTIwYmFyfGVufDB8MHx8fDE3ODg0MTE2MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "red and white flowers on table",
      credit: "Nicolas Picard",
      creditUrl: "https://unsplash.com/@artnok",
    },
  ],
  oysters: [
    {
      url: "https://images.unsplash.com/photo-1633321094192-388268512e0f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxveXN0ZXJzfGVufDB8MHx8fDE3ODg0MTE2Mzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "a plate of oysters on ice with lemon wedges",
      credit: "Anima Visual",
      creditUrl: "https://unsplash.com/@animavisual",
    },
    {
      url: "https://images.unsplash.com/photo-1515503249716-e0175c9d8fab?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxveXN0ZXJzfGVufDB8MHx8fDE3ODg0MTE2Mzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "cooked food on round plate",
      credit: "Tommaso Cantelli",
      creditUrl: "https://unsplash.com/@cant92",
    },
    {
      url: "https://images.unsplash.com/photo-1578882422378-9ed72be08b5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxveXN0ZXJzfGVufDB8MHx8fDE3ODg0MTE2Mzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "selective focus photography of piled shells",
      credit: "Ben Stern",
      creditUrl: "https://unsplash.com/@benst287",
    },
    {
      url: "https://images.unsplash.com/photo-1616977782967-a1859e09b014?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxveXN0ZXJzfGVufDB8MHx8fDE3ODg0MTE2Mzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "person in black leather jacket holding silver fork",
      credit: "Thomas John",
      creditUrl: "https://unsplash.com/@shotbytj",
    },
  ],
  weekend: [
    {
      url: "https://images.unsplash.com/photo-1657222214001-2819cece6490?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxyb2FkJTIwdHJpcCUyMGZyaWVuZHN8ZW58MHwwfHx8MTc4ODQxMTY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "people in a car",
      credit: "Christian Lue",
      creditUrl: "https://unsplash.com/@christianlue",
    },
    {
      url: "https://images.unsplash.com/photo-1616425642460-8496b486ad05?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxyb2FkJTIwdHJpcCUyMGZyaWVuZHN8ZW58MHwwfHx8MTc4ODQxMTY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "woman in white jacket and black framed eyeglasses sitting beside woman in black framed eyeglasses during",
      credit: "Jack Delulio",
      creditUrl: "https://unsplash.com/@jackdelulio",
    },
    {
      url: "https://images.unsplash.com/photo-1552235743-ba02eafa3ebd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxyb2FkJTIwdHJpcCUyMGZyaWVuZHN8ZW58MHwwfHx8MTc4ODQxMTY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "man wearing black wetsuit holding white surfboard",
      credit: "Eddy Billard",
      creditUrl: "https://unsplash.com/@eddybllrd",
    },
    {
      url: "https://images.unsplash.com/photo-1765959344666-f8b6fd51dcb5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxyb2FkJTIwdHJpcCUyMGZyaWVuZHN8ZW58MHwwfHx8MTc4ODQxMTY0MHww&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "People gathered around a car in a snowy landscape",
      credit: "leoon liang",
      creditUrl: "https://unsplash.com/@leoonliang",
    },
  ],
  music: [
    {
      url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwyfHxsaXZlJTIwbXVzaWMlMjB2ZW51ZXxlbnwwfDB8fHwxNzg4NDExNjQ0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "people gathering on concert field",
      credit: "Danny Howe",
      creditUrl: "https://unsplash.com/@dannyhowe",
    },
    {
      url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwxfHxsaXZlJTIwbXVzaWMlMjB2ZW51ZXxlbnwwfDB8fHwxNzg4NDExNjQ0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "concert photos",
      credit: "Nainoa Shizuru",
      creditUrl: "https://unsplash.com/@nainoa",
    },
    {
      url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHwzfHxsaXZlJTIwbXVzaWMlMjB2ZW51ZXxlbnwwfDB8fHwxNzg4NDExNjQ0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "stage light front of audience",
      credit: "Yvette de Wit",
      creditUrl: "https://unsplash.com/@yvettedewit",
    },
    {
      url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w2NTc4ODd8MHwxfHNlYXJjaHw0fHxsaXZlJTIwbXVzaWMlMjB2ZW51ZXxlbnwwfDB8fHwxNzg4NDExNjQ0fDA&ixlib=rb-4.1.0&q=80&w=1080",
      alt: "group of people in front of stage",
      credit: "Aditya Chinchure",
      creditUrl: "https://unsplash.com/@adityachinchure",
    },
  ],
} satisfies Record<string, Photo[]>;

export type PhotoKey = keyof typeof SUBJECTS;

// Ordered specific-to-generic, and every short token is \b-anchored.
// Both matter: an unanchored /run/ matches "b-run-ch", which put a photo
// of a runner on a brunch calendar, and /live/ would match "olive".
// Anchoring alone isn't enough either — "brunch" has to be tested before
// "run" can be, hence the ordering.
const THEME_RULES: Array<[RegExp, PhotoKey]> = [
  [/\bbrunch\b|\bbreakfast\b|\bcoffee\b/i, "dinner"],
  [/happy.?hour|\bcocktails?\b|\bwine\b|\bbars?\b|\bdrinks?\b|nightlife/i, "drinks"],
  [/\bdate\b|datenight|romantic|\bdinner\b|\bsupper\b|restaurant|\bfood\b/i, "dinner"],
  [/rooftop|\bpatio\b|\bsummer\b/i, "rooftop"],
  [/weekend|getaway|escape|\btrips?\b|explor|adventure|travel/i, "weekend"],
  [/family|\bkids?\b|parent|toddler|playground/i, "family"],
  [/\bruns?\b|\brunning\b|\bjog|marathon|\braces?\b/i, "run"],
  [/\byoga\b|pilates|wellness|meditat/i, "yoga"],
  [/\bbikes?\b|bicycle|\bcycl|\brides?\b/i, "cycling"],
  [/\bskate|skateboard/i, "skate"],
  [/\bbooks?\b|\breading\b|literar|\bwriting\b/i, "books"],
  [/\bmusic\b|concert|\bbands?\b|\blive\b|\bshows?\b|\bdj\b/i, "music"],
];

function subjectForTheme(theme: string | null | undefined): PhotoKey | null {
  if (!theme) return null;
  for (const [re, key] of THEME_RULES) if (re.test(theme)) return key;
  return null;
}

/** Venue thumbnails for the RSVP demo card, in row order. Reserved: the
 *  grid skips these so the same photo never appears in both places. */
export const DEMO_VENUE_PHOTOS: Photo[] = [
  SUBJECTS.drinks[0],
  SUBJECTS.rooftop[0],
  SUBJECTS.oysters[0],
];

const RESERVED = new Set(DEMO_VENUE_PHOTOS.map((p) => p.url));

/**
 * One photo per calendar, never repeating within the page.
 *
 * A card takes the best unused photo from its own subject. When a subject
 * runs dry — five date-night calendars, four dinner photos — the card gets
 * null and falls back to its gradient wash rather than borrowing a photo
 * from an unrelated subject: these cards link to real calendars, and a
 * confidently wrong picture is worse than an abstract one.
 */
export function assignCoverPhotos(
  themes: Array<string | null | undefined>,
  /** URLs already spoken for elsewhere on the page — typically the real
   *  cover images calendars brought with them, which are Unsplash URLs
   *  too and could otherwise be handed out a second time. */
  alreadyUsed: string[] = []
): Array<Photo | null> {
  const used = new Set<string>([...RESERVED, ...alreadyUsed]);
  return themes.map((theme) => {
    const subject = subjectForTheme(theme);
    if (!subject) return null;
    const pick = SUBJECTS[subject].find((p) => !used.has(p.url));
    if (!pick) return null;
    used.add(pick.url);
    return pick;
  });
}

/** The unifying grade the spec asks for, so a page of photos from a dozen
 *  different photographers still reads as one set. */
export const PHOTO_FILTER = "saturate(.9) contrast(1.02)";

/** Photographers to credit, de-duplicated, for the footer line Unsplash's
 *  guidelines ask for. */
export function allCredits(): Array<{ credit: string; creditUrl: string }> {
  const seen = new Set<string>();
  const out: Array<{ credit: string; creditUrl: string }> = [];
  for (const list of Object.values(SUBJECTS) as Photo[][]) {
    for (const p of list) {
      if (seen.has(p.creditUrl)) continue;
      seen.add(p.creditUrl);
      out.push({ credit: p.credit, creditUrl: p.creditUrl });
    }
  }
  return out;
}

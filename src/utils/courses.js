// Course adjustments relative to Hainburg reference (HCP18 = 89).
// white/yellow = strokes to add to raw score to normalise.
// null = that tee is not available / not rated.
const COURSES = [
  { name: 'Apex Golf Club - Báč',                        white: -4,  yellow: -1  },
  { name: 'Bernolákovo - Park',                            white:  11, yellow:  11 },
  { name: 'BLACK RIVER GOLF RESORT Bernolákovo',          white: -15, yellow: -13 },
  { name: 'Black Stork - Veľká Lomnica (BRAID-VARDON)',   white: -6,   yellow: -3  },
  { name: 'Black Stork - Veľká Lomnica (TAYLOR-BRAID)',   white: -8,   yellow: -5  },
  { name: 'Black Stork - Veľká Lomnica (TAYLOR-VARDON)',  white: -5,   yellow: -2  },
  { name: 'Black Stork - Veľká Lomnica (TAYLOR)',          white: null, yellow: -4  },
  { name: 'Black Stork - Veľká Lomnica (VARDON)',          white: null, yellow: -4  },
  { name: 'Black Stork - Veľká Lomnica (BRAID)',           white: null, yellow: -6  },
  { name: 'Diamond Country Club Rakúsko',                   white: -7,   yellow: -4  },
  { name: 'Eurovalley Golf Park Club Malacky',             white: -14, yellow: -12 },
  { name: 'Golf Agama Koš-Bojnice',                       white: null, yellow: -9  },
  { name: 'Golf Airport Šurany',                          white:  3,  yellow:  5  },
  { name: 'Golf Alpinka Košice',                          white: null, yellow:  5  },
  { name: 'Golf Bojnice - Sebedražie',                    white:  1,  yellow:  1  },
  { name: 'Golf Malá Ida',                                white:  1,  yellow:  1  },
  { name: 'Golf Pegas Lozorno',                           white: 11,  yellow: 13  },
  { name: 'Golf Piešťany',                                white: null, yellow:  4  },
  { name: 'Golf Trenčín',                                 white: null, yellow: 11  },
  { name: 'Golf Trnava',                                  white: null, yellow: 19  },
  { name: 'Grafobal Group Golf Resort Skalica',            white: -5,  yellow: -2  },
  { name: 'Gray Bear - Tále',                             white: -7,  yellow: -4  },
  { name: 'Green Meadows - Ivanka pri Nitre',             white: null, yellow: 10  },
  { name: 'Green Resort Hrubá Borša',                     white: -6,  yellow: -2, black: -8 },
  { name: 'Is Molas Sardinia',                              white: null, yellow: -5  },
  { name: 'St. Johan Alpendorf Blue',                      white: null, yellow:  7  },
  { name: 'Hainburg',                                     white: -2,  yellow:  0  },
  { name: 'Penati Golf Resort - Heritage',                white: -5,  yellow: -3  },
  { name: 'Penati Golf Resort - Legend (72)',              white: -8,  yellow: -4  },
  { name: 'Penati Golf Resort - Legend (73)',              white: -9,  yellow: -5  },
  { name: 'Red Oak Golf Nitra',                           white: -4,  yellow: -1  },
  { name: 'Royal Valley Malý Slavkov',                    white:  3,  yellow:  7  },
  { name: 'Sedin Golf Resort',                            white: -9,  yellow: -6  },
  { name: 'Tri Duby - Sliač',                             white:  4,  yellow:  4  },
]

// Pre-sorted alphabetically for the dropdown
export const COURSES_SORTED = [...COURSES].sort((a, b) =>
  a.name.localeCompare(b.name, 'sk')
)

export const TEE_LABELS = { white: 'Biele', yellow: 'Žlté', black: 'Čierne' }

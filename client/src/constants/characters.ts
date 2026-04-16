export const CHARACTER_COLORS = [
  { name: "Matrix Green",      hex: "#00FF41" },
  { name: "Half-Life Orange",  hex: "#FF6B00" },
  { name: "Jedi Blue",         hex: "#4FC3F7" },
  { name: "Sith Red",          hex: "#FF1744" },
  { name: "Predator Violet",   hex: "#CE93D8" },
  { name: "Tron Yellow",       hex: "#FFE600" },
  { name: "Terminator Chrome", hex: "#B0BEC5" },
  { name: "Mass Effect Blue",  hex: "#0094FF" },
] as const

export const SKILL_LIST = [
  "Admin", "Advocate", "Animals (Handler)", "Animals (Trainer)",
  "Animals (Veterinary)", "Art (Holography)", "Art (Instrument)",
  "Art (Performer)", "Art (Visual Media)", "Art (Write)", "Astrogation",
  "Athletics (Dexterity)", "Athletics (Endurance)", "Athletics (Strength)",
  "Broker", "Carouse", "Deception", "Diplomat", "Drive (Hovercraft)",
  "Drive (Mole)", "Drive (Track)", "Drive (Walker)", "Drive (Wheel)",
  "Electronics (Comms)", "Electronics (Computers)", "Electronics (Remote Ops)",
  "Electronics (Sensors)", "Engineer (J-Drive)", "Engineer (Life Support)",
  "Engineer (M-Drive)", "Engineer (Power)", "Explosives", "Flyer (Airship)",
  "Flyer (Grav)", "Flyer (Ornithopter)", "Flyer (Rotor)", "Flyer (Wing)",
  "Gambler", "Gun Combat (Archaic)", "Gun Combat (Energy)", "Gun Combat (Slug)",
  "Gunner (Capital)", "Gunner (Ortillery)", "Gunner (Screen)", "Gunner (Turret)",
  "Heavy Weapons (Artillery)", "Heavy Weapons (Man Portable)",
  "Heavy Weapons (Vehicle)", "Investigate", "Jack-of-All-Trades",
  "Language (Anglic)", "Language (Aslan)", "Language (Droyne)",
  "Language (Oynprith)", "Language (Trokh)", "Language (Vilani)",
  "Language (Zdetl)", "Leadership", "Mechanic", "Medic", "Melee (Blade)",
  "Melee (Bludgeon)", "Melee (Natural)", "Melee (Unarmed)", "Navigation",
  "Persuade", "Pilot (Capital Ships)", "Pilot (Small Craft)",
  "Pilot (Spacecraft)", "Profession (Belter)", "Profession (Biologicals)",
  "Profession (Civil Engineering)", "Profession (Construction)",
  "Profession (Hydroponics)", "Profession (Polymers)", "Recon",
  "Science (Archaeology)", "Science (Astronomy)", "Science (Biology)",
  "Science (Chemistry)", "Science (Cosmology)", "Science (Cybernetics)",
  "Science (Economics)", "Science (Genetics)", "Science (History)",
  "Science (Linguistics)", "Science (Philosophy)", "Science (Physics)",
  "Science (Planetology)", "Science (Psionicology)", "Science (Psychology)",
  "Science (Robotics)", "Science (Sophontology)", "Science (Xenology)",
  "Seafarer (Ocean Ships)", "Seafarer (Personal)", "Seafarer (Sail)",
  "Seafarer (Submarine)", "Stealth", "Steward", "Streetwise", "Survival",
  "Tactics (Military)", "Tactics (Naval)", "Vacc Suit"
] as const

export const SKILL_CATEGORIES: Record<string, string[]> = {
  "Combat": [
    "Gun Combat (Archaic)", "Gun Combat (Energy)", "Gun Combat (Slug)",
    "Gunner (Capital)", "Gunner (Ortillery)", "Gunner (Screen)", "Gunner (Turret)",
    "Heavy Weapons (Artillery)", "Heavy Weapons (Man Portable)",
    "Heavy Weapons (Vehicle)", "Melee (Blade)", "Melee (Bludgeon)",
    "Melee (Natural)", "Melee (Unarmed)"
  ],
  "Spacer": [
    "Astrogation", "Engineer (J-Drive)", "Engineer (Life Support)",
    "Engineer (M-Drive)", "Engineer (Power)", "Gunner (Capital)",
    "Gunner (Ortillery)", "Gunner (Screen)", "Gunner (Turret)",
    "Pilot (Capital Ships)", "Pilot (Small Craft)", "Pilot (Spacecraft)",
    "Vacc Suit"
  ],
  "Technical": [
    "Electronics (Comms)", "Electronics (Computers)", "Electronics (Remote Ops)",
    "Electronics (Sensors)", "Explosives", "Mechanic",
    "Science (Archaeology)", "Science (Astronomy)", "Science (Biology)",
    "Science (Chemistry)", "Science (Cosmology)", "Science (Cybernetics)",
    "Science (Economics)", "Science (Genetics)", "Science (History)",
    "Science (Linguistics)", "Science (Philosophy)", "Science (Physics)",
    "Science (Planetology)", "Science (Psionicology)", "Science (Psychology)",
    "Science (Robotics)", "Science (Sophontology)", "Science (Xenology)"
  ],
  "Physical": [
    "Athletics (Dexterity)", "Athletics (Endurance)", "Athletics (Strength)",
    "Recon", "Stealth", "Survival"
  ],
  "Social": [
    "Admin", "Advocate", "Broker", "Carouse", "Deception", "Diplomat",
    "Gambler", "Investigate", "Leadership", "Persuade", "Steward", "Streetwise"
  ],
  "Seafaring": [
    "Seafarer (Ocean Ships)", "Seafarer (Personal)", "Seafarer (Sail)",
    "Seafarer (Submarine)"
  ],
  "Ground": [
    "Drive (Hovercraft)", "Drive (Mole)", "Drive (Track)", "Drive (Walker)",
    "Drive (Wheel)", "Flyer (Airship)", "Flyer (Grav)", "Flyer (Ornithopter)",
    "Flyer (Rotor)", "Flyer (Wing)"
  ],
  "Specialized": [
    "Animals (Handler)", "Animals (Trainer)", "Animals (Veterinary)",
    "Art (Holography)", "Art (Instrument)", "Art (Performer)",
    "Art (Visual Media)", "Art (Write)", "Language (Anglic)", "Language (Aslan)",
    "Language (Droyne)", "Language (Oynprith)", "Language (Trokh)",
    "Language (Vilani)", "Language (Zdetl)", "Profession (Belter)",
    "Profession (Biologicals)", "Profession (Civil Engineering)",
    "Profession (Construction)", "Profession (Hydroponics)",
    "Profession (Polymers)", "Tactics (Military)", "Tactics (Naval)"
  ],
  "Other": [
    "Jack-of-All-Trades", "Medic", "Navigation"
  ]
}

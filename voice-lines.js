// Lines guests read aloud when they record their voice: each guest gets a set of 20 (see quotas) and reads it
// in ONE take while the karaoke prompter highlights each line "in your finest Swedish accent". The app knows
// when each line was shown, cuts the take into one clip per line, and the guest's avatar replays those clips
// at matching moments (bar, karaoke, buffet, bathroom, pool, courts, sauna...). Returning guests record a fresh set.
// Fields: id    stable short id, stored per guest
//         cat   moment category (see quotas)
//         text  exactly what the guest reads (noises are spelled out)
//         en    English meaning when text is Swedish
//         hint  easy respelling of Swedish for English speakers (CAPS = stress)
//         kind  "say" | "sing" (sung to any tune) | "sound" (a mouth noise)
//         dur   seconds a relaxed reader needs to say or sing it once
//         cheeky  innuendo line, only for Cheeky guests
//         note  short stage direction shown under the line
// Songs: ABBA appears only as song titles. Other sung lines are public-domain traditionals
// (Ja, må han leva / Helan går / Små grodorna / Happy Birthday to You) or generic la-la-la.
window.FefeVoiceLines = {
  // how many of each category go into one guest's set of 20 (sums to 20; cheeky only for Cheeky guests, taken from react/laugh otherwise)
  quotas: {
    // the organiser's favourites get the most: birthday wishes, cheers, singing and food; one each of the rest
    birthday: 3, cheers: 2, sing: 3, yum: 2, eat: 1, kiss: 1, fart: 1,
    swim: 1, sport: 1, drive: 1, dance: 1, candy: 1, laugh: 1, cheeky: 1
  },
  lines: [
    // ---- birthday: played all over the party ----
    { id: "b1", cat: "birthday", text: "Grattis på födelsedagen, FiFi!", en: "Happy birthday, FiFi!", hint: "GRAT-iss poh FUR-dell-seh-dah-gen, FEE-fee", kind: "say", dur: 2.4 },
    { id: "b2", cat: "birthday", text: "Grattis, FiFi!", en: "Congrats, FiFi!", hint: "GRAT-iss, FEE-fee", kind: "say", dur: 1.2 },
    { id: "b3", cat: "birthday", text: "Grattis på fyrtioårsdagen, FiFi!", en: "Happy 40th birthday, FiFi!", hint: "GRAT-iss poh FUR-tee-ohsh-dah-gen, FEE-fee", kind: "say", dur: 2.6 },
    { id: "b4", cat: "birthday", text: "FiFi fyller fyrtio!", en: "FiFi turns forty!", hint: "FEE-fee FEWL-ler FUR-tee", kind: "say", dur: 1.6 },
    { id: "b5", cat: "birthday", text: "Hurra för FiFi!", en: "Hooray for FiFi!", hint: "hoo-RAH fur FEE-fee", kind: "say", dur: 1.3, note: "cheer it!" },
    { id: "b6", cat: "birthday", text: "FiFi, han leve! Hurra, hurra, hurra, hurra!", en: "Long live FiFi! Hooray, hooray, hooray, hooray!", hint: "FEE-fee, han LEH-veh! hoo-RAH (x4)", kind: "say", dur: 3.4, note: "shout the hurras!" },
    { id: "b7", cat: "birthday", text: "Stort grattis, FiFi!", en: "Big congrats, FiFi!", hint: "stoort GRAT-iss, FEE-fee", kind: "say", dur: 1.3 },
    { id: "b8", cat: "birthday", text: "Grattis, gubben!", en: "Happy birthday, old man!", hint: "GRAT-iss, GUB-ben", kind: "say", dur: 1.2, note: "teasing grin" },
    { id: "b9", cat: "birthday", text: "Fyrtio år och fortfarande snygg!", en: "Forty and still gorgeous!", hint: "FUR-tee ohr ock FOORT-fah-ran-deh snewg", kind: "say", dur: 2.4 },
    { id: "b10", cat: "birthday", text: "Ja, må han leva!", en: "Yes, may he live long!", hint: "yah, moh han LEH-vah", kind: "sing", dur: 2.0, note: "sing it!" },
    { id: "b11", cat: "birthday", text: "Grattis på dagen, FiFi!", en: "Congrats on your day, FiFi!", hint: "GRAT-iss poh DAH-gen, FEE-fee", kind: "say", dur: 1.8 },
    { id: "b12", cat: "birthday", text: "Vi älskar dig, FiFi!", en: "We love you, FiFi!", hint: "vee ELL-skar day, FEE-fee", kind: "say", dur: 1.5 },
    { id: "b13", cat: "birthday", text: "Hipp hipp hurra för FiFi!", en: "Hip hip hooray for FiFi!", hint: "hip hip hoo-RAH fur FEE-fee", kind: "say", dur: 1.8 },
    { id: "b14", cat: "birthday", text: "Äntligen fyrtio!", en: "Forty at last!", hint: "ENT-lee-gen FUR-tee", kind: "say", dur: 1.5 },
    { id: "b15", cat: "birthday", text: "Tack för att du finns, FiFi!", en: "Thanks for being you, FiFi!", hint: "tack fur at doo finns, FEE-fee", kind: "say", dur: 1.7, note: "from the heart" },
    { id: "b16", cat: "birthday", text: "Happy birthday, FiFi!", kind: "say", dur: 1.5 },
    { id: "b17", cat: "birthday", text: "Happy fortieth, FiFi!", kind: "say", dur: 1.6 },
    { id: "b18", cat: "birthday", text: "Happy birthday, birthday boy!", kind: "say", dur: 1.7 },
    { id: "b19", cat: "birthday", text: "Forty and fabulous!", kind: "say", dur: 1.4, note: "diva voice" },
    { id: "b20", cat: "birthday", text: "Welcome to the forties, FiFi!", kind: "say", dur: 1.9 },
    { id: "b21", cat: "birthday", text: "Happy birthday to you!", kind: "sing", dur: 2.2, note: "sing it!" },
    { id: "b22", cat: "birthday", text: "Make a wish, FiFi!", kind: "say", dur: 1.2 },
    { id: "b23", cat: "birthday", text: "We love FiFi!", kind: "say", dur: 1.1 },
    { id: "b24", cat: "birthday", text: "Vi älskar FiFi!", en: "We love FiFi!", hint: "vee ELL-skar FEE-fee", kind: "say", dur: 1.2 },

    // ---- cheers: the bar, toasts, the snaps song ----
    { id: "c1", cat: "cheers", text: "Skål!", en: "Cheers!", hint: "skohl", kind: "say", dur: 0.8, note: "raise your glass!" },
    { id: "c2", cat: "cheers", text: "Skål för FiFi!", en: "Cheers to FiFi!", hint: "skohl fur FEE-fee", kind: "say", dur: 1.2 },
    { id: "c3", cat: "cheers", text: "Skål på dig, FiFi!", en: "Cheers to you, FiFi!", hint: "skohl poh day, FEE-fee", kind: "say", dur: 1.3 },
    { id: "c4", cat: "cheers", text: "Skål allihopa!", en: "Cheers, everyone!", hint: "skohl AL-ee-hoo-pah", kind: "say", dur: 1.3 },
    { id: "c5", cat: "cheers", text: "Botten upp!", en: "Bottoms up!", hint: "BOT-ten oop", kind: "say", dur: 1.0 },
    { id: "c6", cat: "cheers", text: "Helan går!", en: "Down in one!", hint: "HEH-lan gohr", kind: "sing", dur: 1.3, note: "snaps song, sing!" },
    { id: "c7", cat: "cheers", text: "Sjung hopp faderallan lallan lej!", en: "Sing hey fa-la-la-la-lay!", hint: "shung hop FAH-deh-ral-lan LAL-lan lay", kind: "sing", dur: 3.0, note: "sing it!" },
    { id: "c8", cat: "cheers", text: "Skål för fyrtio år!", en: "Cheers to forty years!", hint: "skohl fur FUR-tee ohr", kind: "say", dur: 1.5 },
    { id: "c9", cat: "cheers", text: "Skål och grattis!", en: "Cheers and congrats!", hint: "skohl ock GRAT-iss", kind: "say", dur: 1.2 },
    { id: "c10", cat: "cheers", text: "En till, tack!", en: "Another one, please!", hint: "en till, tack", kind: "say", dur: 1.0 },
    { id: "c11", cat: "cheers", text: "Svep den!", en: "Down it!", hint: "svehp den", kind: "say", dur: 0.8, note: "chant it!" },
    { id: "c12", cat: "cheers", text: "Dags för en snaps!", en: "Time for a shot!", hint: "dahgs fur en snaps", kind: "say", dur: 1.2 },
    { id: "c13", cat: "cheers", text: "Cheers!", kind: "say", dur: 0.8 },
    { id: "c14", cat: "cheers", text: "Cheers to FiFi!", kind: "say", dur: 1.2 },
    { id: "c15", cat: "cheers", text: "Here's to forty more, FiFi!", kind: "say", dur: 1.7 },
    { id: "c16", cat: "cheers", text: "Raise your glasses!", kind: "say", dur: 1.2 },
    { id: "c17", cat: "cheers", text: "To the birthday boy!", kind: "say", dur: 1.3 },
    { id: "c18", cat: "cheers", text: "Drinks are on FiFi!", kind: "say", dur: 1.3, note: "big grin" },

    // ---- sing: the karaoke choir (ABBA as titles only; the rest traditional or generic) ----
    { id: "s1", cat: "sing", text: "Ja, må han leva uti hundrade år!", en: "Yes, may he live for a hundred years!", hint: "yah, moh han LEH-vah OO-tee HUN-dra-deh ohr", kind: "sing", dur: 3.5, note: "birthday song, sing!" },
    { id: "s2", cat: "sing", text: "Ja, visst ska han leva!", en: "Yes, of course he shall live!", hint: "yah, vist skah han LEH-vah", kind: "sing", dur: 2.2, note: "sing it!" },
    { id: "s3", cat: "sing", text: "Och den som inte helan tar…", en: "And whoever skips the first shot…", hint: "ock den som IN-teh HEH-lan tahr", kind: "sing", dur: 2.6, note: "snaps song, sing!" },
    { id: "s4", cat: "sing", text: "…han heller inte halvan får!", en: "…won't get the second one either!", hint: "han HEL-ler IN-teh HAL-van fohr", kind: "sing", dur: 2.6, note: "sing it!" },
    { id: "s5", cat: "sing", text: "Små grodorna, små grodorna!", en: "Little frogs, little frogs!", hint: "smoh GROO-door-nah, smoh GROO-door-nah", kind: "sing", dur: 2.4, note: "midsummer song, sing!" },
    { id: "s6", cat: "sing", text: "Kou ack ack ack!", en: "Croak croak croak!", hint: "KOH-ack ack ack", kind: "sing", dur: 1.8, note: "sing like a frog" },
    { id: "s7", cat: "sing", text: "Åh, vad vi sjunger bra!", en: "Oh, how well we sing!", hint: "oh, vah vee SHUNG-er brah", kind: "sing", dur: 2.0, note: "proud choir voice" },
    { id: "s8", cat: "sing", text: "Sjung med, FiFi!", en: "Sing along, FiFi!", hint: "shung mehd, FEE-fee", kind: "sing", dur: 1.4, note: "sing it!" },
    { id: "s9", cat: "sing", text: "Money, money, money!", kind: "sing", dur: 2.0, note: "sing it, ABBA style!" },
    { id: "s10", cat: "sing", text: "Waterloo!", kind: "sing", dur: 1.3, note: "belt it out!" },
    { id: "s11", cat: "sing", text: "Mamma mia!", kind: "sing", dur: 1.4, note: "sing it dramatically" },
    { id: "s12", cat: "sing", text: "Dancing queen!", kind: "sing", dur: 1.3, note: "disco diva voice" },
    { id: "s13", cat: "sing", text: "Gimme! Gimme! Gimme!", kind: "sing", dur: 1.8, note: "sing it!" },
    { id: "s14", cat: "sing", text: "Super trouper!", kind: "sing", dur: 1.4, note: "arms up, sing!" },
    { id: "s15", cat: "sing", text: "Voulez-vous!", kind: "sing", dur: 1.3, note: "sing it, very French" },
    { id: "s16", cat: "sing", text: "Chiquitita!", kind: "sing", dur: 1.4, note: "sing it softly" },
    { id: "s17", cat: "sing", text: "Fernando!", kind: "sing", dur: 1.3, note: "big dreamy voice" },
    { id: "s18", cat: "sing", text: "Take a chance on me!", kind: "sing", dur: 1.8, note: "sing it!" },
    { id: "s19", cat: "sing", text: "La la la la la!", kind: "sing", dur: 1.8, note: "sing it!" },
    { id: "s20", cat: "sing", text: "Oh oh oh oh oh!", kind: "sing", dur: 1.8, note: "big stadium voice" },
    { id: "s21", cat: "sing", text: "FiFi, FiFi, FiFi!", kind: "sing", dur: 2.0, note: "football chant" },
    { id: "s22", cat: "sing", text: "Happy birthday, dear FiFi!", kind: "sing", dur: 2.4, note: "hold the last note" },

    // ---- kiss: kissing ----
    { id: "k1", cat: "kiss", text: "Mwah!", kind: "sound", dur: 0.8, note: "big smooch" },
    { id: "k2", cat: "kiss", text: "Mwah! Mwah!", kind: "sound", dur: 1.0, note: "air kiss, both cheeks" },
    { id: "k3", cat: "kiss", text: "Mmmmwah!", kind: "sound", dur: 1.2, note: "long, loud smooch" },
    { id: "k4", cat: "kiss", text: "Mwa-mwa-mwa!", kind: "sound", dur: 1.1, note: "three quick pecks" },
    { id: "k5", cat: "kiss", text: "Puss puss!", en: "Kiss kiss!", hint: "puhss puhss", kind: "say", dur: 0.9 },
    { id: "k6", cat: "kiss", text: "Puss på dig!", en: "A kiss for you!", hint: "puhss poh day", kind: "say", dur: 1.0, note: "blow a kiss" },
    { id: "k7", cat: "kiss", text: "Puss och kram!", en: "Hugs and kisses!", hint: "puhss ock krahm", kind: "say", dur: 1.0 },
    { id: "k8", cat: "kiss", text: "Kiss kiss!", kind: "say", dur: 0.9 },
    { id: "k9", cat: "kiss", text: "Pucker up!", kind: "say", dur: 0.9 },
    { id: "k10", cat: "kiss", text: "Come here, you!", kind: "say", dur: 1.0, note: "flirty voice" },

    // ---- fart: the bathroom ----
    { id: "f1", cat: "fart", text: "Pffffrrrt!", kind: "sound", dur: 1.3, note: "blow a raspberry" },
    { id: "f2", cat: "fart", text: "Prrt! Prrt! Prrt!", kind: "sound", dur: 1.4, note: "three little toots" },
    { id: "f3", cat: "fart", text: "Brrrraaap!", kind: "sound", dur: 1.2, note: "big trumpet blast" },
    { id: "f4", cat: "fart", text: "Pfffffffft…", kind: "sound", dur: 1.8, note: "slow sneaky leak" },
    { id: "f5", cat: "fart", text: "Oj, förlåt!", en: "Oops, sorry!", hint: "oy, fur-LOHT", kind: "say", dur: 1.0, note: "embarrassed whisper" },
    { id: "f6", cat: "fart", text: "Det var inte jag!", en: "It wasn't me!", hint: "deh var IN-teh yah", kind: "say", dur: 1.3 },
    { id: "f7", cat: "fart", text: "Usch, vad det luktar!", en: "Ew, what a smell!", hint: "oosh, vah deh LUK-tar", kind: "say", dur: 1.4, note: "pinch your nose" },
    { id: "f8", cat: "fart", text: "Oops, sorry!", kind: "say", dur: 1.0 },
    { id: "f9", cat: "fart", text: "It wasn't me!", kind: "say", dur: 1.1 },
    { id: "f10", cat: "fart", text: "FiFi did it!", kind: "say", dur: 1.1, note: "point and giggle" },

    // ---- eat: eating noises at the buffet and dinner table ----
    { id: "e1", cat: "eat", text: "Nom nom nom!", kind: "sound", dur: 1.2, note: "munch away" },
    { id: "e2", cat: "eat", text: "Smask smask!", kind: "sound", dur: 1.0, note: "smack your lips" },
    { id: "e3", cat: "eat", text: "Crunch crunch!", kind: "sound", dur: 1.0, note: "crunchy bites" },
    { id: "e4", cat: "eat", text: "Slurrrp!", kind: "sound", dur: 1.0, note: "slurp the noodles" },
    { id: "e5", cat: "eat", text: "Mums mums mums!", en: "Yum yum yum!", hint: "mooms mooms mooms", kind: "say", dur: 1.2 },
    { id: "e6", cat: "eat", text: "Gulp!", kind: "sound", dur: 0.8, note: "big swallow" },
    { id: "e7", cat: "eat", text: "Mm-hmm-mmm!", kind: "sound", dur: 1.2, note: "mouth full, nodding" },
    { id: "e8", cat: "eat", text: "Glufs glufs!", kind: "sound", dur: 1.0, note: "gobble it down" },
    { id: "e9", cat: "eat", text: "Tugga, tugga, tugga…", en: "Chew, chew, chew…", hint: "TUG-gah, TUG-gah, TUG-gah", kind: "say", dur: 1.6 },
    { id: "e10", cat: "eat", text: "Buuurp!", kind: "sound", dur: 1.0, note: "big happy burp" },
    { id: "e11", cat: "eat", text: "Jag är proppmätt!", en: "I'm stuffed!", hint: "yah air PROP-met", kind: "say", dur: 1.2, note: "pat your belly" },
    { id: "e12", cat: "eat", text: "Seconds, please!", kind: "say", dur: 1.0 },

    // ---- yum: food compliments at the buffet ----
    { id: "y1", cat: "yum", text: "Mmm, det är gott!", en: "Mmm, that's good!", hint: "mmm, deh air gott", kind: "say", dur: 1.4 },
    { id: "y2", cat: "yum", text: "Mmm, vad gott!", en: "Mmm, so tasty!", hint: "mmm, vah gott", kind: "say", dur: 1.2 },
    { id: "y3", cat: "yum", text: "Så gott, FiFi!", en: "So tasty, FiFi!", hint: "soh gott, FEE-fee", kind: "say", dur: 1.2 },
    { id: "y4", cat: "yum", text: "Smaskens!", en: "Scrumptious!", hint: "SMAS-kens", kind: "say", dur: 0.9 },
    { id: "y5", cat: "yum", text: "Jättegott!", en: "Super tasty!", hint: "YET-teh-gott", kind: "say", dur: 1.0 },
    { id: "y6", cat: "yum", text: "Köttbullar! Mmm!", en: "Meatballs! Mmm!", hint: "SHUTT-bull-ar! mmm", kind: "say", dur: 1.4 },
    { id: "y7", cat: "yum", text: "Smaklig måltid!", en: "Enjoy your meal!", hint: "SMAHK-lee MOHL-teed", kind: "say", dur: 1.2 },
    { id: "y8", cat: "yum", text: "Vilken god mat!", en: "What delicious food!", hint: "VIL-ken good maht", kind: "say", dur: 1.2 },
    { id: "y9", cat: "yum", text: "Smörgåsbord! Mmm!", en: "Swedish buffet! Mmm!", hint: "SMUR-gohs-boord! mmm", kind: "say", dur: 1.5 },
    { id: "y10", cat: "yum", text: "Det här är supergott!", en: "This is super tasty!", hint: "deh hair air SOO-per-gott", kind: "say", dur: 1.5 },
    { id: "y11", cat: "yum", text: "Mmm, that's good food!", kind: "say", dur: 1.4 },
    { id: "y12", cat: "yum", text: "Mmm, it's delicious!", kind: "say", dur: 1.5 },
    { id: "y13", cat: "yum", text: "So yummy!", kind: "say", dur: 0.9 },
    { id: "y14", cat: "yum", text: "Compliments to the chef!", kind: "say", dur: 1.5, note: "chef's kiss" },
    { id: "y15", cat: "yum", text: "Pass the meatballs!", kind: "say", dur: 1.1 },
    { id: "y16", cat: "yum", text: "Lechon and meatballs? Yes please!", kind: "say", dur: 2.0 },

    // ---- swim: the pool ----
    { id: "w1", cat: "swim", text: "Nu badar vi!", en: "Let's go swimming!", hint: "noo BAH-dar vee", kind: "say", dur: 1.1 },
    { id: "w2", cat: "swim", text: "Hoppa i!", en: "Jump in!", hint: "HOP-pah ee", kind: "say", dur: 0.9 },
    { id: "w3", cat: "swim", text: "Kom i, vattnet är skönt!", en: "Come on in, the water's lovely!", hint: "kom ee, VAT-net air shurnt", kind: "say", dur: 1.6 },
    { id: "w4", cat: "swim", text: "Let's go swimming!", kind: "say", dur: 1.1 },
    { id: "w5", cat: "swim", text: "Cannonball!", kind: "say", dur: 1.0, note: "shout it!" },
    { id: "w6", cat: "swim", text: "Blub blub blub…", kind: "sound", dur: 1.2, note: "blow bubbles" },

    // ---- sport: tennis, basketball, billiards, ping-pong ----
    { id: "p1", cat: "sport", text: "Bra serve!", en: "Good serve!", hint: "brah serv", kind: "say", dur: 0.9 },
    { id: "p2", cat: "sport", text: "Snyggt skott!", en: "Nice shot!", hint: "snewgt skott", kind: "say", dur: 1.0 },
    { id: "p3", cat: "sport", text: "Pingis, någon?", en: "Ping-pong, anyone?", hint: "PING-iss, NOH-gon", kind: "say", dur: 1.2 },
    { id: "p4", cat: "sport", text: "Jag vann!", en: "I won!", hint: "yah vann", kind: "say", dur: 0.8, note: "victory shout" },
    { id: "p5", cat: "sport", text: "Good serve!", kind: "say", dur: 0.9 },
    { id: "p6", cat: "sport", text: "Game, set and match!", kind: "say", dur: 1.3, note: "umpire voice" },

    // ---- drive: driving and crashing ----
    { id: "d1", cat: "drive", text: "Tuta och kör!", en: "Let's roll! (lit. honk and drive)", hint: "TOO-tah ock shur", kind: "say", dur: 1.1 },
    { id: "d2", cat: "drive", text: "Vilken galning!", en: "What a maniac!", hint: "VIL-ken GAHL-ning", kind: "say", dur: 1.1 },
    { id: "d3", cat: "drive", text: "Brum brum!", kind: "sound", dur: 1.0, note: "rev the engine" },
    { id: "d4", cat: "drive", text: "Crazy driver!", kind: "say", dur: 1.1 },
    { id: "d5", cat: "drive", text: "Watch out!", kind: "say", dur: 0.8, note: "panicked shout" },
    { id: "d6", cat: "drive", text: "Screeeech… CRASH!", kind: "sound", dur: 1.5, note: "brakes, then bang" },

    // ---- hot: sauna, shower, dance floor, bedroom ----
    { id: "h1", cat: "hot", text: "Det är varmt här inne!", en: "It's hot in here!", hint: "deh air varmt hair IN-neh", kind: "say", dur: 1.5 },
    { id: "h2", cat: "hot", text: "Dags för bastu!", en: "Sauna time!", hint: "dahgs fur BAHS-too", kind: "say", dur: 1.1 },
    { id: "h3", cat: "hot", text: "Puh, vad varmt!", en: "Phew, it's hot!", hint: "puh, vah varmt", kind: "say", dur: 1.0, note: "fan yourself" },
    { id: "h4", cat: "hot", text: "Oj, vad det ångar!", en: "Whoa, it's steamy!", hint: "oy, vah deh OHNG-ar", kind: "say", dur: 1.2 },
    { id: "h5", cat: "hot", text: "It's hot in here!", kind: "say", dur: 1.1 },
    { id: "h6", cat: "hot", text: "Is it hot in here, or is it just me?", kind: "say", dur: 2.2, note: "flirty wink" },

    // ---- dance: the dance floor ----
    { id: "n1", cat: "dance", text: "Nu dansar vi!", en: "Let's dance!", hint: "noo DAN-sar vee", kind: "say", dur: 1.1 },
    { id: "n2", cat: "dance", text: "Alla på dansgolvet!", en: "Everybody on the dance floor!", hint: "AL-lah poh DANS-gol-vet", kind: "say", dur: 1.5 },
    { id: "n3", cat: "dance", text: "Dansa, FiFi!", en: "Dance, FiFi!", hint: "DAN-sah, FEE-fee", kind: "say", dur: 1.1 },
    { id: "n4", cat: "dance", text: "Vilka moves!", en: "What moves!", hint: "VIL-kah moovs", kind: "say", dur: 1.0 },
    { id: "n5", cat: "dance", text: "Conga line!", kind: "say", dur: 1.0, note: "shout it!" },
    { id: "n6", cat: "dance", text: "Unts unts unts!", kind: "sound", dur: 1.2, note: "beatbox the bass" },

    // ---- candy ----
    { id: "ca1", cat: "candy", text: "Jag vill ha godis!", en: "I want candy!", hint: "yah vill hah GOO-diss", kind: "say", dur: 1.3, note: "whiny kid voice" },
    { id: "ca2", cat: "candy", text: "Lördagsgodis!", en: "Saturday sweets!", hint: "LUR-dahgs-goo-diss", kind: "say", dur: 1.3 },
    { id: "ca3", cat: "candy", text: "Saltlakrits? Nej tack!", en: "Salty liquorice? No thanks!", hint: "SALT-lah-krits? nay tack", kind: "say", dur: 1.6, note: "pull a face" },
    { id: "ca4", cat: "candy", text: "I want candy!", kind: "say", dur: 1.1 },
    { id: "ca5", cat: "candy", text: "Sugar rush!", kind: "say", dur: 0.9, note: "hyper voice" },
    { id: "ca6", cat: "candy", text: "Just one more piece!", kind: "say", dur: 1.2 },

    // ---- laugh ----
    { id: "l1", cat: "laugh", text: "Ha ha ha ha!", kind: "sound", dur: 1.3, note: "big belly laugh" },
    { id: "l2", cat: "laugh", text: "Tee-hee-hee!", kind: "sound", dur: 1.0, note: "little giggle" },
    { id: "l3", cat: "laugh", text: "Mwahaha!", kind: "sound", dur: 1.3, note: "evil villain laugh" },
    { id: "l4", cat: "laugh", text: "Hahaha, vad kul!", en: "Hahaha, so fun!", hint: "ha-ha-ha, vah kool", kind: "say", dur: 1.5 },
    { id: "l5", cat: "laugh", text: "Jag dör!", en: "I'm dying! (laughing)", hint: "yah dur", kind: "say", dur: 0.8, note: "crying with laughter" },
    { id: "l6", cat: "laugh", text: "Jag skrattar ihjäl mig!", en: "I'm laughing myself to death!", hint: "yah SKRAT-tar ee-YELL may", kind: "say", dur: 1.5 },
    { id: "l7", cat: "laugh", text: "That's hilarious!", kind: "say", dur: 1.2 },

    // ---- drunk: late at the bar ----
    { id: "dr1", cat: "drunk", text: "Hick!", kind: "sound", dur: 0.8, note: "one big hiccup" },
    { id: "dr2", cat: "drunk", text: "Skååål… hick!", en: "Cheeeers… hic!", hint: "skoooohl… hick", kind: "say", dur: 1.6, note: "slur it" },
    { id: "dr3", cat: "drunk", text: "Jag är inte full!", en: "I'm not drunk!", hint: "yah air IN-teh full", kind: "say", dur: 1.3, note: "slur it" },
    { id: "dr4", cat: "drunk", text: "Jag älskar er allihopa!", en: "I love you all!", hint: "yah ELL-skar ehr AL-ee-hoo-pah", kind: "say", dur: 1.8, note: "drunk and emotional" },
    { id: "dr5", cat: "drunk", text: "I'm not drunk!", kind: "say", dur: 1.2, note: "totally slurred" },
    { id: "dr6", cat: "drunk", text: "Who moved the floor?", kind: "say", dur: 1.2, note: "wobbly voice" },

    // ---- greet: arriving and leaving ----
    { id: "g1", cat: "greet", text: "Hej hej!", en: "Hi hi!", hint: "hey hey", kind: "say", dur: 0.8, note: "wave hello" },
    { id: "g2", cat: "greet", text: "Välkommen!", en: "Welcome!", hint: "VELL-kom-men", kind: "say", dur: 0.9 },
    { id: "g3", cat: "greet", text: "Tjenare!", en: "Hey there!", hint: "SHEH-nah-reh", kind: "say", dur: 0.9 },
    { id: "g4", cat: "greet", text: "Hej då!", en: "Bye!", hint: "hey doh", kind: "say", dur: 0.8, note: "wave goodbye" },
    { id: "g5", cat: "greet", text: "Hello, everybody!", kind: "say", dur: 1.4 },
    { id: "g6", cat: "greet", text: "Bye bye, FiFi!", kind: "say", dur: 1.1 },

    // ---- react: surprises, bumps, yes and no ----
    { id: "r1", cat: "react", text: "Oj oj oj!", en: "Oh dear, oh dear!", hint: "oy oy oy", kind: "say", dur: 0.9 },
    { id: "r2", cat: "react", text: "Ja, ja, ja!", en: "Yes, yes, yes!", hint: "yah yah yah", kind: "say", dur: 0.9 },
    { id: "r3", cat: "react", text: "Nej, nej, nej!", en: "No, no, no!", hint: "nay nay nay", kind: "say", dur: 0.9 },
    { id: "r4", cat: "react", text: "Nämen!", en: "Well, I never!", hint: "NEH-men", kind: "say", dur: 0.8, note: "pleasantly surprised" },
    { id: "r5", cat: "react", text: "Herregud!", en: "Oh my God!", hint: "HAIR-eh-good", kind: "say", dur: 0.9 },
    { id: "r6", cat: "react", text: "Wow!", kind: "say", dur: 0.8 },
    { id: "r7", cat: "react", text: "Ouch!", kind: "say", dur: 0.8 },

    // ---- cheeky: innuendo only, Cheeky guests only ----
    { id: "x1", cat: "cheeky", text: "Let's boom boom!", kind: "say", dur: 1.0, cheeky: true, note: "eyebrows up" },
    { id: "x2", cat: "cheeky", text: "Oh là là!", kind: "say", dur: 1.0, cheeky: true, note: "French flirt" },
    { id: "x3", cat: "cheeky", text: "Do not disturb!", kind: "say", dur: 1.1, cheeky: true },
    { id: "x4", cat: "cheeky", text: "Ooh, sexy!", kind: "say", dur: 1.0, cheeky: true, note: "sultry voice" },
    { id: "x5", cat: "cheeky", text: "Stör ej!", en: "Do not disturb!", hint: "stur ay", kind: "say", dur: 0.8, cheeky: true },
    { id: "x6", cat: "cheeky", text: "Hallå där, snygging!", en: "Hello there, gorgeous!", hint: "hah-LOH dair, SNEWG-ing", kind: "say", dur: 1.3, cheeky: true, note: "smooth voice" },
    { id: "x7", cat: "cheeky", text: "Ska vi mysa?", en: "Shall we cuddle up?", hint: "skah vee MEW-sah", kind: "say", dur: 1.0, cheeky: true },
    { id: "x8", cat: "cheeky", text: "We love pussy!", note: "FiFi's other meaning", kind: "say", dur: 1.1, cheeky: true }
  ]
};

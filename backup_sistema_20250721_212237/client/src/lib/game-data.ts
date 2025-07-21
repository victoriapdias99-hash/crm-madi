export function getMysteryData(mysteryId: string) {
  const mysteries = {
    missing_manuscript: {
      id: "missing_manuscript",
      title: "The Missing Manuscript",
      chapter: "Chapter 2: The Library",
      description: "You enter the university library where Professor García's manuscript was last seen. On the librarian's desk, you find a note written in Spanish with some words you don't recognize. The note mentions something about 'reunión secreta' and gives a time.",
      imageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400",
      clues: [
        {
          id: "mysterious_note",
          title: "Mysterious Note",
          description: "A handwritten note in Spanish with unusual vocabulary",
          requiredCharacter: "detective",
          isUnlocked: true,
          requiresTeam: false
        },
        {
          id: "ancient_dictionary",
          title: "Ancient Dictionary",
          description: "Old Spanish-English dictionary with missing pages",
          requiredCharacter: "linguist",
          isUnlocked: false,
          requiresTeam: true
        }
      ],
      currentInvestigation: "You're examining the mysterious note. Some Spanish words are highlighted for translation practice."
    }
  };
  
  return mysteries[mysteryId as keyof typeof mysteries] || mysteries.missing_manuscript;
}

export function getVocabularyForMystery(mysteryId: string, language: string) {
  const vocabularies = {
    missing_manuscript: {
      spanish: [
        { word: "reunión", translation: "meeting", pronunciation: "reh-oo-nee-ON" },
        { word: "secreta", translation: "secret", pronunciation: "seh-KREH-tah" },
        { word: "manuscrito", translation: "manuscript", pronunciation: "mah-noos-KREE-toh" }
      ],
      french: [
        { word: "réunion", translation: "meeting", pronunciation: "ray-oo-nee-ON" },
        { word: "secrète", translation: "secret", pronunciation: "seh-KRET" },
        { word: "manuscrit", translation: "manuscript", pronunciation: "mah-noo-SKREE" }
      ]
    }
  };
  
  const mysteryVocab = vocabularies[mysteryId as keyof typeof vocabularies] || vocabularies.missing_manuscript;
  return mysteryVocab[language as keyof typeof mysteryVocab] || mysteryVocab.spanish;
}

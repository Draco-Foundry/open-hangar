# fix-locales-english-only

Goal: the stores list English only, until a real translation ships.
Steps: remove the ten _locales folders that only hold the brand name.
Done when: npm test, format:check and check:store pass; the zips carry _locales/en only.

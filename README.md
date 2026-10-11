# radiomaster-mt12-manager

I'm building a website for people who own a RadioMaster MT12, the pistol-grip radio for RC cars, trucks and boats.
It lets you add, edit and delete the models on the radio without going through the radio's own menus.

It is a static site. There is no server, no account and no analytics, and your model files never leave your
computer.

**Status: early.** Right now it reads the models on a radio's card and lists them, and it can copy, move,
rename, delete and restore them on the card. Before its first change it copies the models to a folder called
`APP-BACKUPS` on the card. Changing a card has only been tried on made-up cards so far, not on a real radio.
Adding a model, and showing or changing what a model has, are still clickable mockups running on sample models.
Full documentation comes later.

## Run it

```
npm install
npm run dev
```

Then open http://localhost:5173. The tab on the right edge marked "For reviewers only" jumps to every state of
the mockups.

## License

MIT. See [LICENSE](LICENSE).

This is an independent project. It is not affiliated with RadioMaster or EdgeTX.

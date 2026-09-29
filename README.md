# NPPT

MARCO Engine for lecture decks: a build system that separates a presentation
runtime (1920×1080 canvas, presenter notes, ink tools, print modes, quiz and
simulator plugins) from AI-written lecture content, so a new deck or a
single-slide revision costs a fraction of the tokens that regenerating a whole
HTML file does.

Status: planning. See [PLAN.md](PLAN.md).

NPPT shares its name and license with [MARCO](https://github.com/DoTaeIn/Marco),
DoTaeIn's reasoning engine. It does not include that engine.

## License

- **Engine** (all code): the **MARCO Engine License 1.0** (`LICENSE`), which is
  the Apache License 2.0 plus one Additional Condition: a product that puts the
  engine in front of end users, including a lecture deck built with it, must
  show, somewhere an end user can find it (about screen, help overlay, docs
  page, footer or first-run text):

  > Powered by MARCO — Created by DoTaeIn,
  > Original project: https://github.com/DoTaeIn/Marco

  Personal use, research, evaluation, development, internal tools and plain
  redistribution do not trigger it. Everything else Apache 2.0 allows stays
  allowed, including commercial use. A white-label license without the
  attribution is available from the copyright holder.

- **Lecture content** (slides, notes and media written with the engine)
  belongs to its author and is not covered by this license.

# ADR 0002: Model positions

- Date: 2026-10-10
- Status: accepted. Revised the same day after I reviewed the list: decisions 3, 5 and 7 changed, and 4 and 6
  were extended.

## Context

The radio keeps its models in a list of 60 numbered places, and its own menus show those numbers. The app has to
show each model's position and let people change it.

My first version copied the radio exactly, including leaving a hole in the list after every delete. After
reviewing it I decided the app should close up the list by default and keep the radio's own behaviour as a
choice.

## Decisions

1. **Places.** The list has 60 places, numbered 1 to 60. A place holds one model or is empty.
2. **A position is data on the model.** `Model.position` in `src/domain/model.ts` holds it. I never use a model's
   place in an array to mean its position, because that cannot describe an empty place.
3. **Delete closes up the list by default.** Every place after the deleted model, models and empty places alike,
   moves up one place. Radio setup has a question, "When you delete a model", whose second choice keeps the radio's
   own behaviour: the place is left empty and nothing else moves.
4. **Move** from place A to place B shifts everything between them one place toward A. Empty places shift with the
   models. This is what the radio's own Move does. An empty place can be moved the same way as a model, and the
   place it lands in is empty afterwards.
5. **Empty places exist whatever the setting is,** because a radio can arrive with them already in its list. When
   at least one empty place has a model after it, "Close up empty places" removes every such place in one go. The
   models keep their order and end up in positions 1 to however many there are.
6. **Copy** puts the copy in the first empty place after the original. If there is none after it, the copy goes in
   the lowest-numbered empty place before it, as if the search wrapped round from 60 to 1.
7. **Restore** puts a model back in the position it was deleted from. If that place is taken, the models from
   there down to the next empty place each move down one place, and the confirmation says what moved. If nothing
   is empty after it, the models between the nearest empty place before it and that position each move up one
   place instead.
8. **Undo** puts the whole list back exactly as it was before the change, including which model the radio is set
   to. It covers a delete, a move, and closing up empty places.
9. **Add a model** will use the lowest-numbered empty place.

## How I apply these

- Every rule is a pure function in `src/domain/positions.ts`, with unit tests beside it. The app state calls those
  functions and nothing else decides where a model goes.
- One function, `movePlace`, does every shift. Closing up after a delete is "move the place it left to the end".
  Making room for a restore is "move the next empty place to the old position". So there is one shift rule to get
  right, not three.
- "Your models" lists the places in order. An empty place with a model after it gets its own row, with a drag
  handle and a Move action. The empty places after the last model are summed up in one line.
- Before a delete or a move happens, the dialog says what else will shift. Afterwards the confirmation says what
  did.

## Consequences

- With the default setting the list never gains holes from deleting, so positions stay 1 to n unless the radio
  arrived with gaps or the owner chooses the radio's own behaviour.
- A model's position is where it was when it was deleted. If other models were deleted and the list closed up
  since, restoring it to that number can put it between different neighbours than it had before.
- A copy can land far from its original. The confirmation names the position it went to.
- I have not checked the radio's own behaviour on a real radio yet. Two details are my reading: in decision 6,
  "the first empty place before it" meaning the lowest-numbered one, and in decision 7, what happens when nothing
  is empty after the old place.

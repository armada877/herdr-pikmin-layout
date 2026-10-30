# herdr-pikmin-layout

A Pikmin-themed layout for the [Herdr app](https://herdr.dev). Each coding agent is a Pikmin in a
grassy field. The hypervisor is Olimar. The office on the left shows your agents, and your terminals
fill the right half.

This layout is a fork of [herdr-office-layout](https://github.com/zuccs/herdr-office-layout). It is a
fan project. It is not made by, approved by, or connected to Nintendo. All art is original pixel art.

## Install

1. Copy `pikmin/layouts/pikmin-side.json` into `~/.config/herdr-app/layouts/`.
2. Copy the `pikmin/mods/pikmin` folder into `~/.config/herdr-app/mods/`.
3. Pick **pikmin-side** in the Herdr settings, or run:

   ```sh
   herdr-app do layout.switch --name pikmin-side
   ```

`ctrl-shift-l` goes back to your last layout. To remove the layout, delete the two copies.

The mod makes no network requests. It runs no programs, and it reads no files outside its folder.

## The field

| Agent status | What you see |
| --- | --- |
| working | The Pikmin holds a pellet over its head and bobs |
| blocked | It jumps under a flashing red "!" |
| done | It is planted, with only its leaf, bud, or flower above the ground |
| idle | It stands next to a pellet flower, and it wanders now and then |

- The Pikmin type comes from the agent program: Claude is red, Codex is blue, Gemini is yellow, and
  Cursor is purple. Other programs get a random type.
- Each Pikmin has a leaf, a bud, or a flower. The agent address sets it, so it stays the same.
- The agents in the lead space are drawn as Olimar. The layout sets the lead space with the `lead` prop.
- New Pikmin come out of the Onion. Idle Pikmin visit the trees, the nectar flower, the mushroom, and
  each other. A spotted critter wanders the field.
- The sun moves with the time of day. At night the sky goes dark, the mushroom glows, and fireflies
  come out.
- Click a Pikmin to go to its agent. Hover over it for its tab, space, and status. Click an empty
  sprout to start an agent in that space.

## Layout props

The `pikmin` mod block in `pikmin-side.json` takes these props:

| Prop | Value | Effect |
| --- | --- | --- |
| `grid` | number, for example `4` | The field is this many spots wide. Spaces wrap into bands. |
| `lead` | space name, for example `"hypervisor"` | This space gets its own top band, and its agents are drawn as Olimar. |
| `scale` | number, for example `1.15` | Makes the Pikmin and the text bigger. |
| `scroll` | `true` | The spot size stays the same, and the field scrolls when it has too many agents. |

In grid mode, a space with 1 or 2 agents is one column. A space with 3 to 8 agents has two rows and
gets wider. A space with more than 8 agents gets more rows, up to the grid width.

## Credits

- Original office layout: [herdr-office-layout](https://github.com/zuccs/herdr-office-layout), MIT.
- Font: [PxPlus IBM VGA 8x16](https://int10h.org/oldschool-pc-fonts/) by VileR, CC BY-SA 4.0
  (license in `pikmin/mods/pikmin/fonts/`).

## License

Code: [MIT](LICENSE). The bundled font keeps its own CC BY-SA 4.0 license.

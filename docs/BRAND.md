# ARC MAP — field atlas

Status: first implemented direction, 2026-09-04.

## Identity

Name: **ARC MAP**. Primary promise: **Find your next rabbit hole.**
Product sentence: Explore Arc, follow the stories, and send a hunter after the questions that matter.
Signature action: **Hunt this**.

The visual reference is a working field atlas: coordinates, districts, precise annotations,
an explorer's marked location. Early-web discovery and the pleasure of finding a new territory
should guide the interaction. Nostalgia is curiosity and exploration, not a copied retro skin.

This is an independent product. The name does not imply affiliation with Circle or an official map.
Trademark/domain availability has not been cleared.

## Tokens

| Token | Value | Role |
|---|---|---|
| White | #FFFFFF | Navigation, wordmark background |
| Ink | #18335B | Text and strong controls |
| Paper | #F8FBFF | Reading surface |
| Map | #EDF5FF | Atlas surface |
| Signal blue | #326BFF | Selected place and Hunt this |
| Muted | #627998 | Secondary labels |

User ruling, 2026-09-04: fresh, light and blue, inspired by https://www.arc.io/.
These are original product tokens, not claimed official Arc values.
DM Sans is the only typeface: titles, figures, controls and agent instructions. System sans-serif
is the fallback. Host font files locally before public launch.
ARC MAP is the destination. THE HUNT is the investigation mode. Hunt this is the action.

## Structure

Persistent wordmark + agent entry; short navigation rail; search and districts; a dominant token
atlas; a field-note panel containing observation, open question and Hunt this. A completed scout
returns its evidence below the same map. Mobile stacks map, selected note and findings.

Districts are illustrative navigation groupings inferred from metadata. Do not draw connecting
lines that imply observed flows until the backing relationships have actually been measured.

## Voice

Curious, specific, concise. Ask a question a user can send a hunter to answer.
Use “observed”, “sample”, “unknown”, and source timestamps where those limits affect interpretation.
Avoid “alpha”, “guaranteed opportunity”, “real users” from address counts, and certainty from an
LLM-generated story. The interface should be understandable before a wallet is connected.

## Interaction

Selection moves the blue location marker and changes the field note. Following saves a token
to a visible watchlist. Hunt this uses actual data and returns a bounded report. Motion helps a
user follow state changes; reduced-motion preferences are respected.

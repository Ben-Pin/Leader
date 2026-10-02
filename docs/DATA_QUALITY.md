# Clab data quality

Read-only audit: `node scripts/audit-data.mjs clab`. The counts below were measured on 2 October 2026 and will change as cards are edited.

| Check | Cards |
| --- | ---: |
| Total | 1,191 |
| Country `Not verified` | 366 |
| No last-contact date | 114 |
| No named contact | 12 |
| No contact email | 21 |
| Empty description | 7 |
| Type disagrees with one of the four permanent lists | 0 |
| Structured history entries | 0 |

The 132 pre-existing type/list disagreements were reconciled using the user's existing list placement as authoritative. This changed account types without moving cards or changing their timestamps. The four lists now contain Customers 280, Prospects 821, Partners 65, and Distributors 25.

The remaining gaps need source review. A country, contact date, or discussion should only be filled when correspondence or a reliable company source supports it. Existing summaries in **About customer** are not structured history entries. The audit makes no changes to customer data.

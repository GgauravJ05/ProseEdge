# Architecture Decision Records

Decisions that shape the codebase and would be expensive to reverse. Each record
states the context, the decision, and what it costs. Records are immutable once
accepted; a changed decision gets a new record that supersedes the old one.

| #                                                         | Title                                                | Status                                                       |
| :-------------------------------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------- |
| [0001](0001-toolchain-and-delivery.md)                    | Toolchain and delivery process                       | Accepted (visibility superseded by 0003, deployment by 0008) |
| [0002](0002-document-grammar-and-provenance.md)           | Document grammar ordering, separators and provenance | Accepted                                                     |
| [0003](0003-private-repository.md)                        | Private repository on a free plan                    | Accepted                                                     |
| [0004](0004-deploy-to-vercel.md)                          | Deploy to Vercel from GitHub Actions                 | Superseded by 0008                                           |
| [0008](0008-deploy-through-the-vercel-git-integration.md) | Deploy through the Vercel Git integration            | Accepted                                                     |

New record: copy the section headings of the latest one, take the next number,
and open it in the same PR as the change it justifies.

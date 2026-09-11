# Architecture Decision Records

Decisions that shape the codebase and would be expensive to reverse. Each record
states the context, the decision, and what it costs. Records are immutable once
accepted; a changed decision gets a new record that supersedes the old one.

| #                                                         | Title                                                          | Status                                                       |
| :-------------------------------------------------------- | :------------------------------------------------------------- | :----------------------------------------------------------- |
| [0001](0001-toolchain-and-delivery.md)                    | Toolchain and delivery process                                 | Accepted (visibility superseded by 0003, deployment by 0008) |
| [0002](0002-document-grammar-and-provenance.md)           | Document grammar ordering, separators and provenance           | Accepted                                                     |
| [0003](0003-private-repository.md)                        | Private repository on a free plan                              | Accepted                                                     |
| [0004](0004-deploy-to-vercel.md)                          | Deploy to Vercel from GitHub Actions                           | Superseded by 0008                                           |
| [0005](0005-hacker-news-collection-and-author-strata.md)  | Hacker News collection and author strata                       | Accepted                                                     |
| [0006](0006-stratified-pairs-and-time-splits.md)          | Stratified pairs and time-based splits                         | Accepted                                                     |
| [0007](0007-continuous-delivery-of-the-formatter.md)      | Continuous delivery of the formatter                           | Accepted                                                     |
| [0008](0008-deploy-through-the-vercel-git-integration.md) | Deploy through the Vercel Git integration                      | Accepted                                                     |
| [0009](0009-platform-post-preview.md)                     | Platform post preview, without imitating the platform          | Accepted                                                     |
| [0010](0010-decorations-as-combining-marks.md)            | Decorations as combining marks, provenance without a bijection | Accepted (refines spec §4.2 invariant 3)                     |

New record: copy the section headings of the latest one, take the next number,
and open it in the same PR as the change it justifies.

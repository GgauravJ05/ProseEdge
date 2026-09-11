# Architecture Decision Records

Decisions that shape the codebase and would be expensive to reverse. Each record
states the context, the decision, and what it costs. Records are immutable once
accepted; a changed decision gets a new record that supersedes the old one.

| #                                                        | Title                                                | Status                                              |
| :------------------------------------------------------- | :--------------------------------------------------- | :-------------------------------------------------- |
| [0001](0001-toolchain-and-delivery.md)                   | Toolchain and delivery process                       | Accepted (repository visibility superseded by 0003) |
| [0002](0002-document-grammar-and-provenance.md)          | Document grammar ordering, separators and provenance | Accepted                                            |
| [0003](0003-private-repository.md)                       | Private repository on a free plan                    | Accepted                                            |
| [0005](0005-hacker-news-collection-and-author-strata.md) | Hacker News collection and author strata             | Accepted                                            |

New record: copy the section headings of the latest one, take the next number,
and open it in the same PR as the change it justifies.

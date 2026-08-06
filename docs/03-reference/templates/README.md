# Templates Index

Development Kit ships **6 Markdown templates** in `templates/`, each with YAML frontmatter (`name`, `description`) that the skill validator checks.

## Templates

| Template | Frontmatter Name | Lifecycle Stage | Reference |
| :--- | :--- | :--- | :--- |
| **idea-brief** | `idea-brief` | UNDERSTAND | [idea-brief.md](idea-brief.md) |
| **product-requirements** | `product-requirements` | DEFINE (comprehensive) | [product-requirements.md](product-requirements.md) |
| **feature-spec** | `feature-specification` | DEFINE | [feature-spec.md](feature-spec.md) |
| **technical-design** | `technical-design` | DESIGN | [technical-design.md](technical-design.md) |
| **task-plan** | `task-plan` | PLAN | [task-plan.md](task-plan.md) |
| **review-report** | `review-report` | REVIEW | [review-report.md](review-report.md) |

## How Templates Are Used

- Produced by the corresponding specialist agents (product-discovery-agent, specification-agent, solution-architect-agent, task-planner-agent, reviewers).
- Selected by the artifact level from `adaptive-artifact-planning`.
- Completed content is validated for structure by the consuming agent; there is no automated template validator (see [known-limitations.md](../../11-appendices/known-limitations.md)).

See [adding-a-template.md](../../05-developer-guide/adding-a-template.md) to add a new template.

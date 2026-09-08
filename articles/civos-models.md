# Computational models in CivOS

**Kris Ledel · CivOS**

Computational models connect registered options and perspectives to explicit equations, uncertain inputs, and hard constraints. The workbench calculates where preferences differ, where a constraint fails, and which conclusions hold throughout the stated input bounds. A saved analysis connects those calculations to the evidence and model versions used in a decision.

The current kernel is `civos.affine.v1`. It evaluates declared models. It does not discover physical laws, judge whether a source is true, establish a participant's authority, or infer that an action caused an outcome.

## 1. Define the model

Select a case, register at least two options and one perspective, and open **Models**. Choose **New model**. The model editor uses the options and perspectives already registered in that case; their identifiers and titles remain linked to those records.

Give the model a name and describe its scope, assumptions, and limitations. Add supporting sources where available. For each input, enter:

- A short name used in equations, such as `price`.
- A display label and declared unit.
- A category: **Evidence / measurement**, **Assumption / interpretation**, or **Value judgement**.
- A lower bound, reference value, and upper bound, with `low ≤ reference ≤ high`.

The category is the author's declaration. Selecting Evidence does not verify a fact, and selecting Value judgement does not establish that a preference is shared. Units are descriptive labels; the kernel does not perform dimensional analysis or automatic conversion. Include necessary conversion factors explicitly in the equations.

Each perspective supplies one score expression for every option. Higher scores are preferred within that perspective. The application keeps perspective scales separate: a score of 60 in one perspective is not compared with a score of 60 in another, and the scores are not averaged into a common ranking.

Add hard constraints to the relevant option rules. A constraint contains a label, an expression, a comparison (`≤` or `≥`), and a numeric limit. Constraints belong to a perspective's rule. If a condition must apply in every perspective, include it in each relevant rule. Meeting a score target does not override a failed constraint.

### Supported expressions and limits

Expressions are affine: a constant plus a sum of inputs multiplied by constants. Examples include `80 - 8 * price`, `3 * (x + y) / 2`, and `45`. Parentheses, decimal or scientific-notation numbers, addition, subtraction, multiplication by a constant, and division by a nonzero constant are supported.

Products of two variable-dependent expressions, variable denominators, powers, conditional branches, and functions such as logarithms are not supported. `price * stress` and `1 / price` are rejected. The parser does not execute JavaScript.

| Limit | Current implementation |
| --- | --- |
| Inputs | 1–8 |
| Options | 2–6 |
| Perspectives | 1–4 |
| Constraints | Up to 4 per option, per perspective |
| Expression length | Up to 300 characters |
| Model definition | Up to 24,000 characters |
| Numeric inputs, limits, and supported coefficients | Absolute value at most `10^12` |

Additional expression-complexity and exact-arithmetic limits reject calculations that exceed the supported size. Passing validation establishes that the model can be calculated within these limits, not that its equations are appropriate for the case.

## 2. Read reference results and uncertainty separately

The reference value is a scenario point inside an input's bounds. Moving a slider or entering another reference value changes the live comparison. It does not change a measurement, narrow an interval, or write a record to history.

The full uncertainty set is the Cartesian product of all input intervals: every combination inside the box is allowed. The box supplies no probabilities, confidence levels, or statistical independence claim. It also does not encode correlations or other relationships restricting the combinations. If only some combinations are physically possible, the current box can include impossible combinations and therefore produce conservative conclusions.

For an affine expression, the kernel calculates its minimum and maximum over that box. Comparisons use shared variables: if two options contain the same input term, the term can cancel in their difference. This preserves information that would be lost by subtracting independently calculated score ranges.

| Display | Meaning |
| --- | --- |
| Preferred at reference values | Highest score among options satisfying that perspective's constraints at the displayed reference point. All exact ties are retained. |
| Constraints hold across bounds | Every modeled constraint for that option and perspective holds throughout the box. |
| Constraints hold here; uncertain across bounds | The constraints hold at the reference point, but that conclusion is not established throughout the box. |
| Constraint violated here | At least one constraint fails at the reference point. |
| A constraint fails across bounds | One constraint fails everywhere in the box, so the option cannot satisfy it there. |
| Guaranteed preferred | The option is feasible throughout the box and the kernel certifies that its score is at least as high as each relevant competitor throughout the box. |
| Feasible for every perspective · all bounds | The option satisfies every perspective's modeled constraints throughout the box. This does not imply agreement about its desirability. |
| Shared guaranteed preference | Every perspective certifies the same option as at least tied for best throughout the box. |

Guaranteed preference is a conservative dominance certificate. It is not a maximin rule selecting the largest lower score bound. The implementation may compare an option against a competitor even in parts of the box where that competitor is not feasible. It also does not solve every possible joint constraint-feasibility problem. **Not established** means that this test did not prove the conclusion; it does not prove that no workable choice or agreement exists.

The kernel uses rational arithmetic for comparisons, expression bounds, ties, and calculated boundaries. On-screen decimal values are rounded, generally to six significant digits. Exact fractions are available in the detailed interval, boundary, and explanation views; score tooltips also show exact values. Numeric form fields are stored as JavaScript numbers before conversion to rationals, so arbitrary extra digits typed into those fields are not preserved. Exact calculation refers to the represented inputs, not greater precision in the original evidence.

## 3. Inspect changes and measurement opportunities

Under **Where the choice changes**, choose an input to vary. This view holds all other inputs at their displayed reference values. It calculates score-tie and constraint boundaries, then shows the preferred options between those boundaries. Open **Exact intervals and boundaries** to distinguish an open interval from a tie or constraint boundary at an exact value.

**What could a measurement resolve?** asks a different question. Its certificates fix one evidence input to an exact value while retaining the other inputs' full uncertainty. A displayed range identifies values sufficient to certify a shared weak preference. Weak preference includes ties. Uncovered values remain unresolved by this conservative one-input test.

The **Why measure …?** explanation identifies score comparisons or constraints affected by an evidence input. A reported percentage is the fraction of a score-difference interval's width that an exact measurement would remove. It is not a probability, expected benefit, or estimate of whether a measurement is worth its cost. Enter an actual measurement with error as an interval, then recalculate.

**Explain the disagreement** decomposes each score difference into its constant and input contributions. The input categories remain those declared by the model author. This calculation does not infer whether the real disagreement is factual, interpretive, ethical, or political.

## 4. Work through the synthetic energy example

Choose **Open synthetic example**. This creates a separate workspace containing an invented source, observation, three options, two perspectives, and the model **Energy package comparison**. Every number and operating limit is synthetic. The example makes no claim about real energy systems, prices, equipment, or measured benefits.

The initial inputs are `price ∈ [2,5]` with reference `3`, and `stress ∈ [0,2]` with reference `1`. Both use the unit `synthetic index`. Price is declared an evidence input; stress is declared an assumption.

| Option | Cost perspective | Continuity perspective | Hard rule in both perspectives |
| --- | --- | --- | --- |
| Flexible package | `80 - 8 * price` | `45 - 2 * stress` | None |
| Balanced package | `45` | `60 - 2 * stress` | None |
| Reserve package | `20 + 7 * price` | `80 - 4 * stress` | `stress ≤ 2.5` |

### Initial comparison

At the initial reference point, cost scores are `56`, `45`, and `41`. Continuity scores are `43`, `58`, and `76`. The Cost perspective prefers Flexible; the Continuity perspective prefers Reserve.

| Perspective | Flexible score range | Balanced score range | Reserve score range |
| --- | --- | --- | --- |
| Cost | `[40,64]` | `[45,45]` | `[34,55]` |
| Continuity | `[41,45]` | `[56,60]` | `[72,80]` |

All three packages satisfy the constraints across the initial bounds. Reserve is guaranteed preferred for continuity, but cost has no guaranteed preferred option across the full price range. Shared guaranteed preference is therefore **Not established**. Choose **Save analysis** to preserve this starting result.

### Find the exact price threshold

Select Price index under **Where the choice changes** and inspect the exact boundaries. The relevant difference is:

```text
Flexible cost - Reserve cost = 60 - 15 * price
```

The pointwise cost winner changes at `price = 4`. Flexible and Reserve tie there at `48`, above Balanced's `45`. Flexible wins below `4`; Reserve wins above it while its hard constraint holds.

Set the price reference to `4.5`. Both perspectives now prefer Reserve at the reference point. Shared guaranteed preference remains unestablished because the price bounds are still `[2,5]`. The one-input measurement certificate identifies `4 ≤ price ≤ 5` as sufficient for a shared weak preference when all stress uncertainty is retained.

### Record a synthetic measurement

Under Price index, choose **Record measurement +**. Enter a clearly synthetic measurement name, lower bound `4.2`, reference value `4.5`, upper bound `4.8`, and the exact unit `synthetic index`. Select the example source, or register a separate source explicitly stating that the values are invented. Explain that no external measurement was made in **Method and uncertainty**.

Use the new measurement in the evidence selector. If an earlier what-if reference falls outside the new interval, reset the reference values or choose a valid one. A single available measurement is selected automatically unless you explicitly choose the declared model bounds.

The cost ranges become `[41.6,46.4]` for Flexible, `[45,45]` for Balanced, and `[49.4,53.6]` for Reserve. Reserve is now guaranteed preferred in both perspectives. Its exact cost advantage over Flexible is `[3,12]`. Continuity's Balanced-minus-Flexible difference is exactly `15` because the shared stress terms cancel.

The first saved analysis remains unchanged and is flagged because new evidence arrived. Save a second analysis with the selected measurement. Inspect both versions through the record history and the saved-analysis links.

### Test a failed hard constraint

Stress is an assumption in this model, so change it through **Edit model**. Set its lower bound to `3`, reference to `3.5`, and upper bound to `4`. Explain in the limitations that this new scenario contradicts the old `[0,2]` assumption. It is not a refinement of that interval. Save the new model version.

Measurements belong to an exact model version. The earlier price measurement does not automatically transfer to the revised model. To reproduce this comparison, record the synthetic price interval `[4.2,4.8]`, reference `4.5`, for the new model version with its source and method recorded again.

Reserve's constraint slack is now `[-1.5,-0.5]`: the rule fails throughout the stress interval. Its high raw scores remain inspectable, but it is excluded from the reference-point preference comparison. At the reference point, Balanced wins for both perspectives.

Flexible and Balanced remain feasible throughout the box. Balanced is guaranteed preferred for continuity; cost still has no guaranteed winner over `[4.2,4.8]`. At price `4.2`, Flexible scores `46.4` against Balanced's `45`; their exact tie is `price = 35/8`, or `4.375`. Do not interpret the nominal agreement as a shared guarantee across all allowed prices.

## 5. Save an analysis and attach it to a decision

Live exploration does not write to history. **Save analysis** records the exact model identifier, selected measurement identifiers, scenario reference overrides, kernel version, history-prefix length and hash, and a reproducible result summary. The server recalculates that summary before accepting it. Saved analyses cannot be revised in place; save another analysis to record a new basis or scenario.

In the decision form, select the analysis under **Saved model analysis**. The selected option must belong to that analysis. The usual requirements for a decision still apply, including a responsible participant, stated authority, review of the option's observation basis, the working rule, objections, target, and follow-up deadline. The synthetic workspace does not bypass those requirements.

The application rejects an attached analysis whose tracked basis has changed or become blocked. It also rejects a selected option that violates any modeled hard constraint at the saved reference values. It does not require that the option be preferred, guarantee feasibility throughout every bound, or establish authority to act. The decision's rationale must address any uncertainty the organisation accepts.

A local decision cannot attach an analysis retained from the imported portion of a branch; save a local analysis first. The model and its record history can be included in the workspace's signed export, but a valid calculation or signature does not certify the underlying facts.

## 6. Handle measurements, conflicts, and revisions

A measurement requires an evidence input, its exact declared unit, at least one source, a method and uncertainty description, and ordered lower, reference, and upper values. An analysis selects at most one measurement per input from its exact model version. A selected measurement replaces the declared interval for that calculation; the application does not automatically intersect it with the old bounds or establish compatibility with them.

If several current measurements exist for the same input, the workbench requires an explicit evidence choice. It does not average them or choose the most recent one silently. You can also explicitly select **Use declared model bounds**. That choice is a calculation basis, not a resolution of the evidential disagreement.

A measurement revision keeps its model version and input identifier. The old measurement stays in history. Model changes append a new version through `supersedes`, preserving the earlier definition and the analyses that used it.

**Saved analyses and affected decisions** and the coordination findings identify tracked changes:

- A new or revised measurement marks an analysis as changed. Where one unambiguous replacement can be used, the application recalculates and reports whether preference or feasibility changed.
- Conflicting replacement measurements, or a new interval excluding a saved scenario reference, block an automatic update until the evidence and scenario are chosen explicitly.
- Revisions to a linked model, option, perspective, or source block the existing analysis basis pending review of the exact versions.

These checks concern recorded dependencies. They do not discover missing evidence, authenticate measurement methods, decide which conflicting source is correct, or rewrite an existing decision. Review the changed basis, save a new analysis, and record any resulting decision revision through the normal workflow.

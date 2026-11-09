# ME-PHYS-14 — scientific data access request (DRAFT / NOT SENT)

Prepared for issue #452 / PR #455. This is a draft research request, NOT an outreach action and NOT permission to use, redistribute, or commercially exploit third-party measurements.

## Request A — same-ball aerodynamics and spin measurements

**Relevant study:** Hong and Asai, *Orientation-Dependent Drag Crisis and Flight Response of the FIFA World Cup Match Ball Trionda*, Fluids 11(5), 128 (2026). https://www.mdpi.com/2311-5521/11/5/128

**Draft to the corresponding authors:**

Subject: Research data availability — same-specimen football aerodynamics and spin measurements

Dear researchers,

I am developing a physics-based football simulation and am assessing whether your published wind-tunnel results could support a scientifically defensible *single-ball* reference model. I understand that the orientation-dependent Trionda study provides non-spinning coefficients and simulated trajectories, not a validated spinning-ball force law.

Would you be able to confirm whether machine-readable measurements from the *same tested specimen* are available, and whether your group has independently measured spin-resolved aerodynamic force/torque or observed free-flight datasets for that same specimen?

Where available, I would be interested in: (1) airspeed and Reynolds number, measured Cd, side/lift force components with axis conventions and signed spin rate; (2) ball orientation, pressure, air density/temperature, repeat counts and instrument uncertainty; (3) rotational drag/decay; (4) independently captured 3D flight tracks, timestamps, launch velocities and angular velocities, with ball center definition and camera error estimates.

If raw files can be shared, could you specify the exact specimen identifiers, acquisition session IDs, coordinate/unit conventions, licensing terms and whether reproducible derived models may be incorporated into a publicly distributed or commercial game? I will not redistribute original measurements or use your materials outside the permitted scope.

Thank you for considering the request.

[Project representative / contact — to be added by the sender]

## Request B — independent Soccer Ball 3D trajectory evaluation rights

**Upstream project:** https://github.com/lukaszgrad/ball3d
**Official file format / license statement:** https://github.com/lukaszgrad/ball3d/blob/main/DATA.md

**Draft to the dataset maintainers:**

Subject: Soccer Ball 3D dataset — evaluation permissions and metadata clarification

Hello,

I am evaluating a standalone 3D football trajectory model and noticed that your CVPRW 2026 release provides triangulated ball positions and segment-level ground truth. Your DATA.md states non-commercial academic research use under CC BY-NC-SA 4.0, with additional restrictions for raw broadcast footage.

Before accessing or using any dataset files, could you clarify whether the triangulated 3D coordinate annotations alone may be used for internal evaluation of a potentially commercial simulation project, without redistribution, and under what written permission or license? If this is not permitted, I will not download or use them.

For scientifically valid comparisons, could you also clarify known physical ball identity, ball-center/ground reference, uncertainty and camera-calibration accuracy, whether independent angular spin was recorded, and how to distinguish independent kick/acquisition groups across views and segments? I understand that the fitted trajectory parameters in predictions are *not* measured aerodynamic coefficients.

Thank you.

[Project representative / contact — to be added by the sender]


## Request C — Ward et al. 2023 same-specimen spinning and drag wind-tunnel data (UNSENT)

**Article:** Ward et al., *The effect of surface geometry on the aerodynamic behaviour of a football*, Sports Engineering 26, 33 (2023). https://doi.org/10.1007/s12283-023-00409-5

**Corresponding author named on the article:** M. A. Passmore, Loughborough University — M.A.Passmore@lboro.ac.uk.

**Subject:** Data availability — paired nonspinning/spinning aerodynamic measurements for tested football specimens

Dear Professor Passmore,

I am assessing reference data for a single-ball physical simulation of football flight. Your 2023 Sports Engineering study is particularly relevant because it reports both nonspinning drag and spinning side-force sweeps using the same experimental ball designs, including tests around 100–400 rpm and transitions through reverse Magnus.

Would it be possible to obtain, or learn the access conditions for, machine-readable measured data from the same documented test specimens? The ideal files would contain airspeed or Reynolds number, rotational speed and signed axis, Cd and Cy (including negative values), orientation, specimen/geometry ID, wind-tunnel density/temperature, support correction, repeat/trial identifiers and uncertainty/error estimates. I would also appreciate clarification about whether equivalent raw records exist for the Brazuca or Telstar18 comparison balls.

Could you confirm whether any independent high-speed-camera 3D free-flight tracks, launch spin data or spin-decay data were collected for those exact specimens? If not, please say so; the wind-tunnel evidence is still valuable but would not constitute a held-out flight validation.

Your paper is openly accessible under CC BY 4.0. Could you clarify whether any separately shared raw measurement files may be used to derive reproducible coefficients for a potentially public/commercial football simulation, subject to attribution, and whether redistribution of raw records is restricted? I would not publish raw files or use them beyond the terms you approve.

Thank you for considering the request.

[Sender signature — to be supplied manually]

**Status:** DRAFT ONLY; no email sent. The published CC BY 4.0 license is for the article and covered material, not proof of separate private raw-data permissions.

## Decision gate — requires explicit authorization

- [ ] Permission and attribution for any actual dataset files are documented and approved.
- [ ] Any sampled coefficient grid is measured for the **same physical ball specimen**.
- [ ] Spin signs, axes, units, air density and observational uncertainty are known.
- [ ] Held-out test groups are independent original kicks/acquisition sessions, not frame-level random splits.
- [ ] Full 3D launch velocity **and independently measured angular spin** are provided or clearly marked unavailable.
- [ ] Original raw files are excluded from public repository artifacts unless redistribution is explicitly permitted.
- [ ] Quantitative calibration metrics and a universal model change require new owner approval.

**No messages sent, no files downloaded, no gameplay physical values changed.**

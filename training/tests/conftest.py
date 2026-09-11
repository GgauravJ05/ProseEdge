# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

import os

from hypothesis import settings

# Same budget as fast-check on the TypeScript side (ADR 0001): 200 examples per
# property by default; HYPOTHESIS_PROFILE=deep runs 20,000.
settings.register_profile("default", max_examples=200)
settings.register_profile("deep", max_examples=20_000, deadline=None)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "default"))

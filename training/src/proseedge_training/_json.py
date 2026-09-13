# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Gaurav Jadhav <gauravmakarandjadhav@gmail.com>

"""Checks for values decoded from JSON, which arrive typed as `object`."""

from typing import cast


def as_object(value: object, what: str, error: type[ValueError]) -> dict[str, object]:
    if not isinstance(value, dict):
        raise error(f"{what} must be a JSON object")
    # json.loads only ever produces string keys for objects.
    return cast("dict[str, object]", value)


def as_list(value: object, what: str, error: type[ValueError]) -> list[object]:
    if not isinstance(value, list):
        raise error(f"{what} must be a JSON array")
    return cast("list[object]", value)


def expect[T](fields: dict[str, object], key: str, kind: type[T], error: type[ValueError]) -> T:
    value = fields.get(key)
    # bool is an int subclass; `"rows": true` is still a type error.
    if not isinstance(value, kind) or (isinstance(value, bool) and kind is not bool):
        raise error(f"{key} must be {kind.__name__}, got {value!r}")
    return value

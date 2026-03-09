"""
Order flow logic based on per-restaurant ProcessConfig.

get_valid_transitions() returns the list of valid next statuses
based on the process_snapshot stored on the order at creation time.
"""

from models import OrderStatus


def get_valid_transitions(current_status: OrderStatus, process_snapshot: dict | None) -> list[OrderStatus]:
    """
    Return valid next statuses based on current status and process config snapshot.

    Rules:
      kitchen OFF → no transitions (PLACED is terminal)
      kitchen ON, waiter OFF → PLACED→CONFIRMED→PREPARING→READY (READY is terminal)
      kitchen ON, waiter ON → full flow through DELIVERED
    """
    if not process_snapshot:
        # Legacy orders with no snapshot — allow full flow
        process_snapshot = {"kitchen_module": True, "waiter_module": True}

    kitchen_on = process_snapshot.get("kitchen_module", True)
    waiter_on = process_snapshot.get("waiter_module", True)

    # CANCELLED and REMOVED are always terminal regardless of config
    if current_status in (OrderStatus.CANCELLED, OrderStatus.REMOVED):
        return []

    if not kitchen_on:
        # No kitchen → PLACED is terminal
        return []

    if kitchen_on and not waiter_on:
        # Kitchen only — stop at READY
        transitions = {
            OrderStatus.PLACED: [OrderStatus.CONFIRMED],
            OrderStatus.CONFIRMED: [OrderStatus.PREPARING],
            OrderStatus.PREPARING: [OrderStatus.READY],
        }
        return transitions.get(current_status, [])

    # Full flow (kitchen + waiter)
    transitions = {
        OrderStatus.PLACED: [OrderStatus.CONFIRMED],
        OrderStatus.CONFIRMED: [OrderStatus.PREPARING],
        OrderStatus.PREPARING: [OrderStatus.READY],
        OrderStatus.READY: [OrderStatus.PICKED_UP],
        OrderStatus.PICKED_UP: [OrderStatus.DELIVERED],
    }
    return transitions.get(current_status, [])


def validate_module_combination(kitchen_module: bool, waiter_module: bool) -> str | None:
    """
    Returns error message if module combination is invalid, or None if valid.
    """
    if waiter_module and not kitchen_module:
        return "Waiter module requires Kitchen module to be enabled"
    return None

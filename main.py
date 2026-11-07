from mss import MSS
from mss.tools import to_png
from screeninfo import Monitor, get_monitors


def get_primary_monitor() -> Monitor:
    monitors = get_monitors()
    if not monitors:
        raise RuntimeError("No active monitors were detected.")

    if len(monitors) > 1:
        print(
            f"Detected {len(monitors)} active monitors; capturing the primary screen."
        )

    primary_monitor = next(
        (monitor for monitor in monitors if monitor.is_primary),
        None,
    )
    if primary_monitor is None:
        raise RuntimeError("Unable to identify the primary monitor.")

    return primary_monitor


def grabImage() -> None:
    """
    Capture only the primary screen.
    """
    primary_monitor = get_primary_monitor()
    monitor_bounds = {
        "left": primary_monitor.x,
        "top": primary_monitor.y,
        "width": primary_monitor.width,
        "height": primary_monitor.height,
    }

    with MSS() as sct:
        screenshot = sct.grab(monitor_bounds)
        print("image grabbed, but not stored on the disk")


if __name__ == "__main__":
    grabImage()

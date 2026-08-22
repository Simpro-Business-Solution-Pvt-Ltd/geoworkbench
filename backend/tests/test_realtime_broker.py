from app.core.realtime import RealtimeBroker, RealtimeEvent


def test_realtime_broker_delivers_matching_borehole_events() -> None:
    broker = RealtimeBroker()
    bh_10 = broker.subscribe(10)
    bh_20 = broker.subscribe(20)
    global_sub = broker.subscribe()

    broker.publish(RealtimeEvent(type="workbench.interval.updated", borehole_id=10))

    assert bh_10.next_event(timeout=0.01).type == "workbench.interval.updated"
    assert global_sub.next_event(timeout=0.01).borehole_id == 10
    assert bh_20.next_event(timeout=0.01) is None

    bh_10.close()
    bh_20.close()
    global_sub.close()
    assert broker.subscriber_count() == 0


def test_realtime_broker_drops_oldest_event_when_subscription_queue_is_full() -> None:
    broker = RealtimeBroker()
    subscription = broker.subscribe(10)
    _, queue = broker._subscriptions[subscription.subscription_id]
    queue.maxsize = 1

    broker.publish(RealtimeEvent(type="first", borehole_id=10))
    broker.publish(RealtimeEvent(type="second", borehole_id=10))

    assert subscription.next_event(timeout=0.01).type == "second"
    subscription.close()

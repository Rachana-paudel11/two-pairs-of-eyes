const stopsData = {
  "stops": [
    {
      "id": "stop_01",
      "title": "Ground-Level Hazard",
      "location": "warehouse_transit_zone",
      "hazard": {
        "present": true,
        "type": "ground_level",
        "subtype": "fluid_spill",
        "severity": "moderate"
      },
      "supervisor": {
        "name": "Dave",
        "behaviour": "dismissive",
        "dialogue": "People have been walking around it all morning. Someone will clean it later."
      },
      "inspect_reveals": "The spill extends under the racking edge and there is no absorbent granule nearby.",
      "actions": {
        "cordon_off": {
          "interaction": "cordonOff",
          "points": 5,
          "outcome": "optimal",
          "consequence": "area_secured",
          "feedback": "You controlled the risk instead of stepping around it."
        },
        "report_only": {
          "interaction": "report",
          "points": 3,
          "outcome": "partial",
          "consequence": "spill_remains_active",
          "feedback": "Reporting is right, but the walkway stayed open in the meantime."
        },
        "ignore": {
          "interaction": "ignore",
          "points": 0,
          "outcome": "failure",
          "consequence": "near_miss_slip",
          "feedback": "A hazard was normalized because it had been there all morning."
        }
      },
      "flags_on_failure": ["ignored_ground_hazard"],
      "learning_objective": "Do not normalize common workplace hazards."
    },
    {
      "id": "stop_02",
      "title": "Blind-Corner Forklift",
      "location": "warehouse_racking_aisle_a_junction",
      "hazard": {
        "present": true,
        "type": "vehicle_pedestrian_conflict",
        "subtype": "blocked_sightline",
        "severity": "severe"
      },
      "supervisor": {
        "name": "Dave",
        "behaviour": "uncertain",
        "dialogue": "I can't tell if he's seen us. Let's hold and get eye contact."
      },
      "inspect_reveals": "The load on the forks is stacked high enough that you still can't see the driver's face from here.",
      "actions": {
        "hold_position": {
          "interaction": "holdPosition",
          "points": 5,
          "outcome": "optimal",
          "consequence": "eye_contact_confirmed",
          "feedback": "You waited with Dave until the driver clearly saw you both. The blocked load meant one set of eyes wasn't enough."
        },
        "report_blind_corner": {
          "interaction": "report",
          "points": 3,
          "outcome": "partial",
          "consequence": "blind_corner_flagged_for_signage",
          "feedback": "Flagging the corner for better sightlines helps the next person, but it doesn't answer the question you had right now."
        },
        "proceed": {
          "interaction": "ignore",
          "points": 0,
          "outcome": "failure",
          "consequence": "near_miss_forklift",
          "feedback": "You assumed you'd been seen. Assuming is exactly what a blocked sightline should rule out."
        }
      },
      "flags_on_failure": ["proceeded_without_confirmation"],
      "learning_objective": "Never assume an operator has seen you; verify together."
    },
    {
      "id": "stop_03",
      "title": "Bent Rack Upright",
      "location": "warehouse_racking_aisle_b",
      "hazard": {
        "present": true,
        "type": "structural",
        "subtype": "bent_upright",
        "severity": "severe"
      },
      "supervisor": {
        "name": "Dave",
        "behaviour": "dismissive",
        "dialogue": "That's been bent since before I started here. It's fine, it's not going anywhere."
      },
      "inspect_reveals": "Looking closer, the upright is bowed enough that the beam above it no longer sits flush in the connector.",
      "actions": {
        "cordon_off": {
          "interaction": "cordonOff",
          "points": 5,
          "outcome": "optimal",
          "consequence": "bay_restricted_pending_inspection",
          "feedback": "You restricted access and flagged it for a structural inspection. A bent upright can fail without warning under load."
        },
        "report_only": {
          "interaction": "report",
          "points": 3,
          "outcome": "partial",
          "consequence": "rack_damage_reported",
          "feedback": "Reporting is right, but the aisle stayed in use while you waited for someone to act on it."
        },
        "ignore": {
          "interaction": "ignore",
          "points": 0,
          "outcome": "failure",
          "consequence": "near_miss_rack_failure",
          "feedback": "Because it had looked that way for as long as anyone could remember, it had stopped registering as damage at all."
        }
      },
      "flags_on_failure": ["ignored_bent_rack"],
      "learning_objective": "Challenge structural damage that's been normalized by familiarity."
    },
    {
      "id": "stop_04",
      "title": "Charging Bay Warning Light",
      "location": "warehouse_charging_bay",
      "hazard": {
        "present": true,
        "type": "fire_risk",
        "subtype": "warning_indicator_with_nearby_combustibles",
        "severity": "moderate"
      },
      "supervisor": {
        "name": "Dave",
        "behaviour": "dismissive",
        "dialogue": "Charger's fine, we've had worse close calls than a blinking light. Someone will swap that battery out eventually."
      },
      "inspect_reveals": "The indicator is amber, not green, and there's a stack of cardboard packaging within arm's reach of the charging point.",
      "actions": {
        "cordon_off": {
          "interaction": "cordonOff",
          "points": 5,
          "outcome": "optimal",
          "consequence": "charger_taken_offline",
          "feedback": "You pulled the combustibles clear and flagged the charger as out of service until the indicator was checked. An early warning sign got treated like the warning it was."
        },
        "report_only": {
          "interaction": "report",
          "points": 3,
          "outcome": "partial",
          "consequence": "charging_fault_reported",
          "feedback": "Reporting the fault was right, but the combustibles stayed within reach of the charging point while you waited."
        },
        "ignore": {
          "interaction": "ignore",
          "points": 0,
          "outcome": "failure",
          "consequence": "near_miss_charging_bay",
          "feedback": "A blinking indicator and a stack of boxes both got treated as background noise, the same way Dave already had."
        }
      },
      "flags_on_failure": ["ignored_charging_warning"],
      "learning_objective": "Early warning indicators are hazards in progress, not decoration."
    },
    {
      "id": "stop_05",
      "title": "Clear Aisle Check",
      "location": "warehouse_finished_goods_aisle",
      "hazard": {
        "present": false
      },
      "supervisor": {
        "name": "Dave",
        "behaviour": "correct",
        "dialogue": "This one's clean, always is. Main aisle, good sightlines, nothing stored where it shouldn't be."
      },
      "inspect_reveals": "Floor markings are intact, nothing blocks the sprinkler clearance, and the racking looks square.",
      "actions": {
        "continue_on": {
          "interaction": "continueOn",
          "points": 5,
          "outcome": "optimal",
          "consequence": "shift_continues",
          "feedback": "You checked it yourself, agreed with Dave's read, and moved on without turning a clear aisle into a paperwork exercise."
        },
        "report_only": {
          "interaction": "report",
          "points": 3,
          "outcome": "partial",
          "consequence": "unnecessary_report_filed",
          "feedback": "Flagging a genuinely clear aisle isn't wrong, but treating every stop as something to escalate has its own cost."
        }
      },
      "flags_on_failure": [],
      "learning_objective": "Not everything needs escalating; over-reporting has a cost."
    }
  ],
  "endOfSessionRules": [
    {
      "id": "escalated_incident",
      "requiresFlags": ["ignored_ground_hazard", "ignored_charging_warning"],
      "consequence": "escalated_incident_cutscene",
      "feedback": "Two separate warning signs went unaddressed. On their own, either might have stayed a near miss. Together, they became the incident report Dave was hoping to avoid."
    }
  ]
};

export default stopsData;

/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solmobile_compute.json`.
 */
export type SolmobileCompute = {
  "address": "SoMC111111111111111111111111111111111111111",
  "metadata": {
    "name": "solmobileCompute",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "SolMobile Compute - Decentralized Physical Infrastructure Network"
  },
  "instructions": [
    {
      "name": "assignTask",
      "discriminator": [
        158,
        142,
        217,
        16,
        175,
        209,
        92,
        237
      ],
      "accounts": [
        {
          "name": "taskAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "deviceAccount",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        }
      ]
    },
    {
      "name": "completeTask",
      "discriminator": [
        109,
        167,
        192,
        41,
        129,
        108,
        220,
        196
      ],
      "accounts": [
        {
          "name": "taskAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "deviceAccount",
          "writable": true
        },
        {
          "name": "networkState",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        },
        {
          "name": "resultHash",
          "type": "string"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "networkState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  101,
                  116,
                  119,
                  111,
                  114,
                  107,
                  95,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "registerDevice",
      "discriminator": [
        210,
        151,
        56,
        68,
        22,
        158,
        90,
        193
      ],
      "accounts": [
        {
          "name": "deviceAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  118,
                  105,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "deviceId"
              }
            ]
          }
        },
        {
          "name": "networkState",
          "writable": true
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "deviceId",
          "type": "string"
        },
        {
          "name": "deviceSpecs",
          "type": {
            "defined": {
              "name": "deviceSpecs"
            }
          }
        }
      ]
    },
    {
      "name": "submitTask",
      "discriminator": [
        148,
        183,
        26,
        116,
        107,
        213,
        118,
        213
      ],
      "accounts": [
        {
          "name": "taskAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  97,
                  115,
                  107
                ]
              },
              {
                "kind": "arg",
                "path": "taskId"
              }
            ]
          }
        },
        {
          "name": "submitter",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "taskId",
          "type": "string"
        },
        {
          "name": "taskType",
          "type": {
            "defined": {
              "name": "taskType"
            }
          }
        },
        {
          "name": "computeRequirements",
          "type": {
            "defined": {
              "name": "computeRequirements"
            }
          }
        },
        {
          "name": "rewardAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateDeviceStatus",
      "discriminator": [
        112,
        232,
        154,
        217,
        65,
        52,
        123,
        111
      ],
      "accounts": [
        {
          "name": "deviceAccount",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "deviceAccount"
          ]
        }
      ],
      "args": [
        {
          "name": "isActive",
          "type": "bool"
        },
        {
          "name": "currentLoad",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "deviceAccount",
      "discriminator": [
        103,
        244,
        245,
        87,
        0,
        208,
        80,
        103
      ]
    },
    {
      "name": "networkState",
      "discriminator": [
        212,
        237,
        148,
        56,
        97,
        245,
        51,
        169
      ]
    },
    {
      "name": "taskAccount",
      "discriminator": [
        235,
        32,
        10,
        23,
        81,
        60,
        170,
        203
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "taskNotPending",
      "msg": "Task is not in pending status"
    },
    {
      "code": 6001,
      "name": "deviceNotActive",
      "msg": "Device is not active"
    },
    {
      "code": 6002,
      "name": "taskNotAssigned",
      "msg": "Task is not assigned"
    },
    {
      "code": 6003,
      "name": "deviceNotAssigned",
      "msg": "Device is not assigned to this task"
    },
    {
      "code": 6004,
      "name": "insufficientCapabilities",
      "msg": "Insufficient device capabilities"
    },
    {
      "code": 6005,
      "name": "taskExpired",
      "msg": "Task expired"
    }
  ],
  "types": [
    {
      "name": "computeRequirements",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cpuCoresRequired",
            "type": "u8"
          },
          {
            "name": "ramGbRequired",
            "type": "u8"
          },
          {
            "name": "storageGbRequired",
            "type": "u16"
          },
          {
            "name": "gpuRequired",
            "type": "bool"
          },
          {
            "name": "estimatedDuration",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "deviceAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "deviceId",
            "type": "string"
          },
          {
            "name": "specs",
            "type": {
              "defined": {
                "name": "deviceSpecs"
              }
            }
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "reputationScore",
            "type": "u16"
          },
          {
            "name": "totalTasksCompleted",
            "type": "u32"
          },
          {
            "name": "totalTokensEarned",
            "type": "u64"
          },
          {
            "name": "currentLoad",
            "type": "u8"
          },
          {
            "name": "lastActive",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "deviceSpecs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "cpuCores",
            "type": "u8"
          },
          {
            "name": "ramGb",
            "type": "u8"
          },
          {
            "name": "storageGb",
            "type": "u16"
          },
          {
            "name": "gpuAvailable",
            "type": "bool"
          },
          {
            "name": "networkSpeed",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "networkState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalDevices",
            "type": "u32"
          },
          {
            "name": "totalTasksCompleted",
            "type": "u64"
          },
          {
            "name": "totalTokensDistributed",
            "type": "u64"
          },
          {
            "name": "networkUtilization",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "taskAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "submitter",
            "type": "pubkey"
          },
          {
            "name": "taskId",
            "type": "string"
          },
          {
            "name": "taskType",
            "type": {
              "defined": {
                "name": "taskType"
              }
            }
          },
          {
            "name": "computeRequirements",
            "type": {
              "defined": {
                "name": "computeRequirements"
              }
            }
          },
          {
            "name": "rewardAmount",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "taskStatus"
              }
            }
          },
          {
            "name": "assignedDevice",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "resultHash",
            "type": "string"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "assignedAt",
            "type": "i64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "taskStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "assigned"
          },
          {
            "name": "inProgress"
          },
          {
            "name": "completed"
          },
          {
            "name": "failed"
          }
        ]
      }
    },
    {
      "name": "taskType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "dataProcessing"
          },
          {
            "name": "mlInference"
          },
          {
            "name": "imageProcessing"
          },
          {
            "name": "videoTranscoding"
          },
          {
            "name": "generalCompute"
          }
        ]
      }
    }
  ]
};

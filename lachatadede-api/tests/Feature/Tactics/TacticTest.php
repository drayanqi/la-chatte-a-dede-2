<?php

namespace Tests\Feature\Tactics;

use App\Models\Script;
use App\Models\Tactic;
use App\Models\TacticPlayer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TacticTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A 1-2-2 formation payload (GK, 2 DEF, 2 ATK) covering all 5 slots.
     */
    private function formationPayload(?User $user = null): array
    {
        $user ??= User::factory()->create();
        $scripts = collect([
            $user->scripts()->create(['name' => 'GK.js', 'code' => 'gk', 'language' => 'javascript']),
            $user->scripts()->create(['name' => 'DEF1.js', 'code' => 'def1', 'language' => 'javascript']),
            $user->scripts()->create(['name' => 'DEF2.js', 'code' => 'def2', 'language' => 'javascript']),
            $user->scripts()->create(['name' => 'ATK1.js', 'code' => 'atk1', 'language' => 'javascript']),
            $user->scripts()->create(['name' => 'ATK2.js', 'code' => 'atk2', 'language' => 'javascript']),
        ]);

        return [
            'name' => '1-2-2 Formation',
            'players' => [
                ['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 45.0, 'script_id' => $scripts[0]->id],
                ['player_slot' => 2, 'position_x' => 25.0, 'position_y' => 30.0, 'script_id' => $scripts[1]->id],
                ['player_slot' => 3, 'position_x' => 25.0, 'position_y' => 15.0, 'script_id' => $scripts[2]->id],
                ['player_slot' => 4, 'position_x' => 70.0, 'position_y' => 25.0, 'script_id' => $scripts[3]->id],
                ['player_slot' => 5, 'position_x' => 70.0, 'position_y' => 15.0, 'script_id' => $scripts[4]->id],
            ],
        ];
    }

    public function test_tactics_require_authentication(): void
    {
        $this->getJson('/api/tactics')->assertStatus(401);
        $this->postJson('/api/tactics', ['name' => 'X'])->assertStatus(401);
    }

    public function test_tactic_persists_with_players_and_script_references(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'x', 'language' => 'javascript']);

        $tactic = $user->tactics()->create(['name' => 'My Tactic']);

        $player = $tactic->players()->create([
            'player_slot' => 1,
            'position_x' => 8.0,
            'position_y' => 25.0,
            'script_id' => $script->id,
        ]);

        $this->assertDatabaseHas('tactics', [
            'id' => $tactic->id,
            'user_id' => $user->id,
            'name' => 'My Tactic',
            'is_public' => false,
            'is_system' => false,
        ]);

        $this->assertDatabaseHas('tactic_player', [
            'id' => $player->id,
            'tactic_id' => $tactic->id,
            'player_slot' => 1,
            'script_id' => $script->id,
        ]);

        // Relations load both ways
        $this->assertTrue($tactic->players->contains($player));
        $this->assertSame($user->id, TacticPlayer::find($player->id)->tactic->user_id);
        $this->assertSame($script->id, TacticPlayer::find($player->id)->script->id);

        // User side of the relation
        $this->assertTrue($user->tactics->contains($tactic));

        // Script can be deleted: slot reference is nulled, not cascaded
        $script->delete();
        $this->assertNull(TacticPlayer::find($player->id)->fresh()->script_id);
    }

    public function test_tactic_is_not_valid_without_unique_slots(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Dupes']);

        $tactic->players()->create(['player_slot' => 1, 'position_x' => 0, 'position_y' => 0]);
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 1, 'position_y' => 1]);
    }

    public function test_deleting_user_cascades_tactics_and_players(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Doomed']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 0, 'position_y' => 0]);

        $user->delete();

        $this->assertDatabaseMissing('tactics', ['id' => $tactic->id]);
        $this->assertDatabaseCount('tactic_player', 0);
    }

    public function test_system_tactic_can_exist_without_user(): void
    {
        $tactic = Tactic::create(['name' => 'Easy Bot', 'is_system' => true]);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 50, 'position_y' => 45]);

        $this->assertDatabaseHas('tactics', [
            'id' => $tactic->id,
            'user_id' => null,
            'is_system' => true,
        ]);

        // User-facing API never exposes other users' (or system) tactics
        $viewer = User::factory()->create();
        $this->actingAs($viewer, 'sanctum')
            ->getJson('/api/tactics')
            ->assertOk()
            ->assertJsonMissing(['name' => 'Easy Bot']);
    }

    public function test_index_returns_only_the_user_tactics_with_players(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $mine = $user->tactics()->create(['name' => 'Mine']);
        $mine->players()->create(['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0]);

        $foreign = $other->tactics()->create(['name' => 'Foreign']);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/tactics');

        $response->assertStatus(200);

        $ids = collect($response->json())->pluck('id');
        $this->assertSame([$mine->id], $ids->all());
        $this->assertNotContains($foreign->id, $ids);

        // Players are eager-loaded into the response
        $this->assertSame(1, count($response->json()[0]['players']));
        $this->assertSame(1, $response->json()[0]['players'][0]['playerSlot']);
    }

    public function test_create_tactic_returns_created_tactic(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $this->formationPayload($user));

        $response->assertStatus(201)
            ->assertJsonPath('name', '1-2-2 Formation')
            ->assertJsonPath('isSystem', false)
            ->assertJsonCount(5, 'players')
            ->assertJsonPath('players.0.playerSlot', 1);

        // JSON numbers have no int/float distinction (PHP serializes 8.0 as
        // 8), so positions are compared numerically.
        $this->assertSame(8.0, (float) $response->json('players.0.positionX'));
        $this->assertSame(45.0, (float) $response->json('players.0.positionY'));

        $script = Script::where('name', 'GK.js')->first();
        $response->assertJsonPath('players.0.scriptId', $script->id);

        // The script's private code must never leak through the tactics API (AC #3)
        $this->assertStringNotContainsString('gk', $response->getContent());

        $tacticId = $response->json('id');
        $this->assertDatabaseHas('tactics', [
            'id' => $tacticId,
            'user_id' => $user->id,
            'name' => '1-2-2 Formation',
        ]);
        $this->assertDatabaseHas('tactic_player', [
            'tactic_id' => $tacticId,
            'player_slot' => 5,
            'script_id' => $response->json('players.4.scriptId'),
        ]);
    }

    public function test_create_tactic_allows_null_script_ids(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Empty slots',
            'players' => [
                ['player_slot' => 1, 'position_x' => 50.0, 'position_y' => 45.0, 'script_id' => null],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('players.0.scriptId', null);

        $this->assertDatabaseHas('tactic_player', [
            'tactic_id' => $response->json('id'),
            'player_slot' => 1,
            'script_id' => null,
        ]);
    }

    public function test_create_tactic_validates_name(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', ['players' => []])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', ['name' => str_repeat('a', 101)])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);
    }

    public function test_create_tactic_validates_slot_out_of_range(): void
    {
        $user = User::factory()->create();

        foreach ([0, 6] as $slot) {
            $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
                'name' => 'Bad slot',
                'players' => [
                    ['player_slot' => $slot, 'position_x' => 50.0, 'position_y' => 25.0],
                ],
            ])->assertStatus(422)
                ->assertJsonValidationErrors(['players.0.player_slot']);
        }
    }

    public function test_create_tactic_validates_positions_out_of_bounds(): void
    {
        $user = User::factory()->create();

        // position_x must be 0-100
        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Bad x',
            'players' => [
                ['player_slot' => 1, 'position_x' => 101.0, 'position_y' => 25.0],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['players.0.position_x']);

        // position_y must be 0-50
        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Bad y',
            'players' => [
                ['player_slot' => 1, 'position_x' => 50.0, 'position_y' => 51.0],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['players.0.position_y']);

        // Negative values rejected
        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Negative',
            'players' => [
                ['player_slot' => 1, 'position_x' => -1.0, 'position_y' => -5.0],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['players.0.position_x', 'players.0.position_y']);
    }

    public function test_create_tactic_rejects_more_than_five_players(): void
    {
        $user = User::factory()->create();

        $players = [];
        foreach (range(1, 6) as $i) {
            // Slots 1-5 reused for the 6th to isolate the max:5 rule
            $players[] = ['player_slot' => ($i % 5) + 1, 'position_x' => 50.0, 'position_y' => 25.0];
        }

        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Too many',
            'players' => $players,
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['players']);
    }

    public function test_create_tactic_rejects_duplicate_slots(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Dupes',
            'players' => [
                ['player_slot' => 1, 'position_x' => 50.0, 'position_y' => 25.0],
                ['player_slot' => 1, 'position_x' => 10.0, 'position_y' => 15.0],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['players.1.player_slot']);
    }

    public function test_create_tactic_rejects_foreign_script_id(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $foreignScript = $other->scripts()->create(['name' => 'NotYours.js', 'code' => 'x', 'language' => 'javascript']);

        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Thief',
            'players' => [
                ['player_slot' => 1, 'position_x' => 50.0, 'position_y' => 25.0, 'script_id' => $foreignScript->id],
            ],
        ])->assertStatus(422);
    }

    public function test_create_tactic_rejects_nonexistent_script_id(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Ghost',
            'players' => [
                ['player_slot' => 1, 'position_x' => 50.0, 'position_y' => 25.0, 'script_id' => '00000000-0000-0000-0000-000000000000'],
            ],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['players.0.script_id']);
    }

    public function test_show_returns_the_tactic_with_players(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Bot.js', 'code' => 'secret-code', 'language' => 'javascript']);
        $tactic = $user->tactics()->create(['name' => 'Shown']);
        $tactic->players()->create([
            'player_slot' => 2,
            'position_x' => 12.5,
            'position_y' => 30.0,
            'script_id' => $script->id,
        ]);

        $response = $this->actingAs($user, 'sanctum')->getJson("/api/tactics/{$tactic->id}");

        $response->assertStatus(200)
            ->assertJsonPath('id', $tactic->id)
            ->assertJsonPath('name', 'Shown')
            ->assertJsonPath('isSystem', false)
            ->assertJsonPath('players.0.playerSlot', 2)
            ->assertJsonPath('players.0.scriptId', $script->id);

        // AC #3: script code stays private
        $this->assertStringNotContainsString('secret-code', $response->getContent());
    }

    public function test_user_cannot_access_another_users_tactic(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $tactic = $owner->tactics()->create(['name' => 'Secret']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 0, 'position_y' => 0]);

        $this->actingAs($intruder, 'sanctum')
            ->getJson("/api/tactics/{$tactic->id}")
            ->assertStatus(404)
            ->assertJsonPath('message', 'Tactic not found');

        $this->actingAs($intruder, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['name' => 'Hacked'])
            ->assertStatus(404);

        $this->actingAs($intruder, 'sanctum')
            ->deleteJson("/api/tactics/{$tactic->id}")
            ->assertStatus(404);

        $this->assertDatabaseHas('tactics', ['id' => $tactic->id, 'name' => 'Secret']);
        $this->assertDatabaseHas('tactic_player', ['tactic_id' => $tactic->id, 'player_slot' => 1]);
    }

    public function test_update_tactic_changes_name_only_when_players_absent(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Old']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0]);

        $response = $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['name' => 'Renamed']);

        $response->assertStatus(200)
            ->assertJsonPath('name', 'Renamed')
            ->assertJsonCount(1, 'players')
            ->assertJsonPath('players.0.playerSlot', 1);

        $this->assertDatabaseHas('tactic_player', [
            'tactic_id' => $tactic->id,
            'player_slot' => 1,
            'position_x' => 8.0,
        ]);
    }

    public function test_update_tactic_replaces_the_full_players_array(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'New.js', 'code' => 'x', 'language' => 'javascript']);
        $tactic = $user->tactics()->create(['name' => 'Lineup']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0]);
        $tactic->players()->create(['player_slot' => 2, 'position_x' => 20.0, 'position_y' => 15.0]);

        $response = $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [
                'players' => [
                    ['player_slot' => 3, 'position_x' => 60.0, 'position_y' => 10.0, 'script_id' => $script->id],
                ],
            ]);

        $response->assertStatus(200)
            ->assertJsonCount(1, 'players')
            ->assertJsonPath('players.0.playerSlot', 3)
            ->assertJsonPath('players.0.scriptId', $script->id)
            ->assertJsonPath('name', 'Lineup');

        $this->assertDatabaseCount('tactic_player', 1);
        $this->assertDatabaseHas('tactic_player', [
            'tactic_id' => $tactic->id,
            'player_slot' => 3,
            'position_x' => 60.0,
            'script_id' => $script->id,
        ]);
    }

    public function test_update_tactic_validates_payload(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Guarded']);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['name' => str_repeat('a', 101)])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name']);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [
                'players' => [
                    ['player_slot' => 9, 'position_x' => 50.0, 'position_y' => 25.0],
                ],
            ])->assertStatus(422)
            ->assertJsonValidationErrors(['players.0.player_slot']);
    }

    public function test_update_tactic_with_null_players_keeps_the_lineup(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Kept']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0]);

        $response = $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['players' => null]);

        $response->assertStatus(200)
            ->assertJsonPath('name', 'Kept')
            ->assertJsonCount(1, 'players')
            ->assertJsonPath('players.0.playerSlot', 1);

        $this->assertDatabaseHas('tactic_player', ['tactic_id' => $tactic->id, 'player_slot' => 1]);
    }

    public function test_update_tactic_with_players_only_bumps_updated_at(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Ordered']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0]);
        $originalUpdatedAt = $tactic->updated_at;

        $this->travel(5)->seconds();

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [
                'players' => [
                    ['player_slot' => 2, 'position_x' => 20.0, 'position_y' => 15.0],
                ],
            ])->assertStatus(200);

        $this->assertTrue($tactic->fresh()->updated_at->greaterThan($originalUpdatedAt));
    }

    public function test_create_tactic_allows_the_same_script_in_multiple_slots(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'Everywhere.js', 'code' => 'x', 'language' => 'javascript']);

        $created = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', [
                'name' => 'Same Script',
                'players' => [
                    ['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0, 'script_id' => $script->id],
                    ['player_slot' => 2, 'position_x' => 25.0, 'position_y' => 30.0, 'script_id' => $script->id],
                ],
            ]);

        $created->assertStatus(201)
            ->assertJsonPath('players.0.scriptId', $script->id)
            ->assertJsonPath('players.1.scriptId', $script->id);
    }

    public function test_destroy_removes_the_tactic_and_cascades_players(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Doomed']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 0, 'position_y' => 0]);

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/tactics/{$tactic->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('tactics', ['id' => $tactic->id]);
        $this->assertDatabaseMissing('tactic_player', ['tactic_id' => $tactic->id]);
    }

    public function test_deleting_a_script_leaves_the_slot_unassigned(): void
    {
        $user = User::factory()->create();
        $payload = $this->formationPayload($user);

        $created = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $payload)
            ->assertStatus(201);

        $players = collect($created->json('players'));
        $removedScriptId = $players[0]['scriptId'];

        // Delete one referenced script: its slot becomes unassigned (null),
        // the other four keep their references.
        Script::find($removedScriptId)->delete();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/tactics/'.$created->json('id'))
            ->assertOk();

        $this->assertSame(5, count($response->json('players')));
        $this->assertNull($response->json('players.0.scriptId'));
        $this->assertNotNull($response->json('players.1.scriptId'));
        $this->assertNotNull($response->json('players.4.scriptId'));
    }

    // ------------------------------------------------------------------
    // Ready tactics (Epic 4 v2, story 4.1)
    // ------------------------------------------------------------------

    public function test_tactic_serializes_the_ranked_fields(): void
    {
        $user = User::factory()->create();

        $created = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $this->formationPayload($user))
            ->assertStatus(201);

        $created->assertJsonPath('isReady', false)
            ->assertJsonPath('elo', 1000)
            ->assertJsonPath('wins', 0)
            ->assertJsonPath('losses', 0);

        $index = $this->actingAs($user, 'sanctum')
            ->getJson('/api/tactics')
            ->assertOk()
            ->assertJsonCount(1);

        $index->assertJsonPath('0.isReady', false)
            ->assertJsonPath('0.elo', 1000)
            ->assertJsonPath('0.wins', 0)
            ->assertJsonPath('0.losses', 0);
    }

    public function test_tactic_can_be_marked_ready_and_unready(): void
    {
        $user = User::factory()->create();

        // A complete lineup first: ready is gated on it (AC #3)
        $created = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $this->formationPayload($user))
            ->assertStatus(201);
        $tacticId = $created->json('id');

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tacticId}", ['is_ready' => true])
            ->assertStatus(200)
            ->assertJsonPath('isReady', true);

        $this->assertDatabaseHas('tactics', ['id' => $tacticId, 'is_ready' => true]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tacticId}", ['is_ready' => false])
            ->assertStatus(200)
            ->assertJsonPath('isReady', false);

        $this->assertDatabaseHas('tactics', ['id' => $tacticId, 'is_ready' => false]);
    }

    public function test_ready_on_store_requires_a_complete_lineup(): void
    {
        $user = User::factory()->create();
        $script = $user->scripts()->create(['name' => 'One.js', 'code' => 'x', 'language' => 'javascript']);

        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Born ready',
            'is_ready' => true,
            'players' => [
                ['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0, 'script_id' => $script->id],
            ],
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Tactic lineup is incomplete');

        // Without the ready flag the same payload is fine
        $this->actingAs($user, 'sanctum')->postJson('/api/tactics', [
            'name' => 'Not ready yet',
            'players' => [
                ['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0, 'script_id' => $script->id],
            ],
        ])->assertStatus(201)
            ->assertJsonPath('isReady', false);
    }

    public function test_ready_on_update_requires_a_complete_lineup(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Half-filled']);
        $tactic->players()->create(['player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['is_ready' => true])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Tactic lineup is incomplete');

        // The gate validates the lineup that results from THIS request: a
        // complete replacement plus the ready flag together is accepted.
        $payload = $this->formationPayload($user);
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [...$payload, 'is_ready' => true])
            ->assertStatus(200)
            ->assertJsonPath('isReady', true);

        $this->assertDatabaseHas('tactics', ['id' => $tactic->id, 'is_ready' => true]);
    }

    public function test_unreadying_is_never_gated(): void
    {
        $user = User::factory()->create();
        // Ready in the database, lineup broken afterwards (script deleted)
        $script = $user->scripts()->create(['name' => 'Gone.js', 'code' => 'x', 'language' => 'javascript']);
        $tactic = $user->tactics()->create(['name' => 'Broken', 'is_ready' => true]);
        $tactic->players()->create([
            'player_slot' => 1, 'position_x' => 8.0, 'position_y' => 25.0, 'script_id' => $script->id,
        ]);
        $script->delete();

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['is_ready' => false])
            ->assertStatus(200)
            ->assertJsonPath('isReady', false);
    }

    public function test_ranked_columns_are_server_managed(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Guarded', 'elo' => 1500, 'wins' => 9, 'losses' => 2]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [
                'name' => 'Guarded',
                'elo' => 9999,
                'wins' => 999,
                'losses' => -999,
            ])
            ->assertStatus(200)
            ->assertJsonPath('elo', 1500)
            ->assertJsonPath('wins', 9)
            ->assertJsonPath('losses', 2);
    }

    // ------------------------------------------------------------------
    // Team customization (Epic 7, story 7.4)
    // ------------------------------------------------------------------

    public function test_tactic_has_default_team_colors_and_null_crest(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Defaults']);

        $this->assertSame('#ff6b1a', $tactic->color_primary);
        $this->assertSame('#1a8cff', $tactic->color_secondary);
        $this->assertNull($tactic->crest);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/tactics/{$tactic->id}")
            ->assertOk()
            ->assertJsonPath('colorPrimary', '#ff6b1a')
            ->assertJsonPath('colorSecondary', '#1a8cff')
            ->assertJsonPath('crest', null);
    }

    public function test_create_tactic_persists_custom_colors_and_crest(): void
    {
        $user = User::factory()->create();

        $payload = $this->formationPayload($user);
        $payload['color_primary'] = '#31c48d';
        $payload['color_secondary'] = '#4aa8e8';
        $payload['crest'] = '🦊';

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $payload)
            ->assertStatus(201)
            ->assertJsonPath('colorPrimary', '#31c48d')
            ->assertJsonPath('colorSecondary', '#4aa8e8')
            ->assertJsonPath('crest', '🦊');

        $this->assertDatabaseHas('tactics', [
            'name' => '1-2-2 Formation',
            'color_primary' => '#31c48d',
            'color_secondary' => '#4aa8e8',
            'crest' => '🦊',
        ]);
    }

    public function test_create_tactic_validates_hex_colors(): void
    {
        $user = User::factory()->create();

        $payload = $this->formationPayload($user);
        $payload['color_primary'] = 'corail';
        $payload['color_secondary'] = '#12345'; // 5 digits

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['color_primary', 'color_secondary']);
    }

    public function test_create_tactic_validates_crest_whitelist(): void
    {
        $user = User::factory()->create();

        $payload = $this->formationPayload($user);
        $payload['crest'] = '🦕';

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tactics', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['crest']);
    }

    public function test_update_tactic_partial_colors_and_crest(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create([
            'name' => 'Painted',
            'color_primary' => '#ff6b1a',
            'color_secondary' => '#1a8cff',
            'crest' => '⚽',
        ]);

        // Absent color keys keep the current values (partial-update law)
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['color_primary' => '#ffc244'])
            ->assertStatus(200)
            ->assertJsonPath('colorPrimary', '#ffc244')
            ->assertJsonPath('colorSecondary', '#1a8cff')
            ->assertJsonPath('crest', '⚽');

        // Crest null clears the crest; colors survive
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['crest' => null])
            ->assertStatus(200)
            ->assertJsonPath('crest', null)
            ->assertJsonPath('colorPrimary', '#ffc244');

        // A new crest can be set later
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", ['crest' => '🐙'])
            ->assertStatus(200)
            ->assertJsonPath('crest', '🐙');

        $this->assertDatabaseHas('tactics', [
            'id' => $tactic->id,
            'color_primary' => '#ffc244',
            'color_secondary' => '#1a8cff',
            'crest' => '🐙',
        ]);
    }

    public function test_update_tactic_validates_colors_and_crest(): void
    {
        $user = User::factory()->create();
        $tactic = $user->tactics()->create(['name' => 'Guarded']);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [
                'color_primary' => '#ff6b1a',
                'crest' => 'x',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['crest']);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/tactics/{$tactic->id}", [
                'color_secondary' => 'blue',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['color_secondary']);
    }
}

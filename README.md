You can find a longer write up on building this on my blog [here](https://nkorai.com/i-built-a-twitch-chat-snake-game)

## How do I run the game
Technically all you need is to check out this repo and run `npm start`. You may have to make sure you have Typescript and Webpack/Webpack CLI installed, maybe globally depending on your dev setup. Add your Twitch channel name in the configuration screen and hit the back button to have the app start listening to your Twitch chat. Try writing a command like "sg:down" and see the Snake change directions. You will see a pop up to authenticate against Twitch after the first game chat message, this authentication is required to allow the app to delete the game command messages from your chat.

## How does the game work
Once the game is started, a new vote is carried out every x milliseconds. Users can vote on what direction and distance the snake moves in by typing in chat commands like sg:right, sg:left, sg:up and sg:down. Users can also chat sg:right10 to move the snake 10 units on that vote, an option I added to allow the game to be sped up if chat chooses to. The votes are tallied and the most voted on command wins e.g. sg:right, sg:right10, sg:left, sg:left in a voting session results in sg:left being executed. Hitting the wall or running over yourself results in dying and a reset.

The game runs in 2 modes:
- Static: If there are no votes in a round, then the snake does not move. If there are votes, the logic described above is executed.
- Continuous: If there are no votes in a round, then the snake keeps moving in the direction it last moved in - 1 unit. If there are votes, the logic described above is executed.

The game keeps track of score and also the high score, which can be reset in the configuration screen. A list of all things that can configured are:
- The channel name
- The game mode
- Minimum chat distance e.g. setting it to 5 makes every vote move the snake 5 units at a minimum
- Maximum chat distance e.g. setting this to 10 (default) prevents chat from moving the snake more than 10 units every vote
- Vote duration (ms): how often to conduct a vote round

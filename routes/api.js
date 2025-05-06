'use strict';

const { Thread } = require('../models');
const mongoose = require('mongoose'); // Added this import

// In-memory mock db for testing if MongoDB is unavailable
const mockThreads = [];
let mockThreadId = 1;
let mockReplyId = 1;

// Helper to get threads from either MongoDB or mock
async function getThreads(board, useDb = true) {
  if (useDb) {
    try {
      return await Thread.find({ board });
    } catch (err) {
      console.error('MongoDB error, using mock:', err);
    }
  }
  // Fallback to mock
  return mockThreads.filter(t => t.board === board);
}

// Helper to get a thread by ID
async function getThreadById(threadId, useDb = true) {
  if (useDb) {
    try {
      return await Thread.findById(threadId);
    } catch (err) {
      console.error('MongoDB error, using mock:', err);
    }
  }
  // Fallback to mock
  return mockThreads.find(t => t._id.toString() === threadId.toString());
}

module.exports = function (app) {

  // Thread routes
  app.route('/api/threads/:board')
    // Create a new thread
    .post(async function (req, res) {
      const { text, delete_password } = req.body;
      const board = req.params.board;

      try {
        let newThread;

        try {
          // Try using MongoDB
          newThread = new Thread({
            text,
            delete_password,
            board,
            created_on: new Date(),
            bumped_on: new Date(),
            reported: false,
            replies: []
          });

          await newThread.save();
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB save error, using mock:', err);
          newThread = {
            _id: mockThreadId++,
            text,
            delete_password,
            board,
            created_on: new Date(),
            bumped_on: new Date(),
            reported: false,
            replies: []
          };
          mockThreads.push(newThread);
        }

        return res.redirect(`/b/${board}/`);
      } catch (err) {
        console.error('Error creating thread:', err);
        return res.status(500).send('Error creating thread');
      }
    })

    // Get the 10 most recent threads with 3 replies each
    .get(async function (req, res) {
      const board = req.params.board;

      try {
        let threads;

        try {
          // Try using MongoDB
          threads = await Thread.find({ board })
            .sort({ bumped_on: -1 })
            .limit(10)
            .select('-reported -delete_password -replies.reported -replies.delete_password')
            .lean();
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          threads = mockThreads
            .filter(t => t.board === board)
            .sort((a, b) => new Date(b.bumped_on) - new Date(a.bumped_on))
            .slice(0, 10)
            .map(t => {
              // Remove sensitive fields
              const { reported, delete_password, ...thread } = t;
              return {
                ...thread,
                replies: t.replies.map(r => {
                  const { reported, delete_password, ...reply } = r;
                  return reply;
                })
              };
            });
        }

        // Limit replies to the 3 most recent, add replycount
        threads.forEach(thread => {
          thread.replycount = thread.replies.length;
          if (thread.replies.length > 3) {
            thread.replies = thread.replies.slice(-3);
          }
        });

        return res.json(threads);
      } catch (err) {
        console.error('Error fetching threads:', err);
        return res.status(500).send('Error fetching threads');
      }
    })

    // Delete a thread
    .delete(async function (req, res) {
      const { thread_id, delete_password } = req.body;

      try {
        let thread;
        let useDb = true;

        try {
          // Try using MongoDB
          thread = await Thread.findById(thread_id);
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          thread = mockThreads.find(t => t._id.toString() === thread_id);
          useDb = false;
        }

        if (!thread) return res.send('incorrect password');

        if (thread.delete_password === delete_password) {
          if (useDb) {
            await Thread.findByIdAndDelete(thread_id);
          } else {
            // Remove from mock array
            const index = mockThreads.findIndex(t => t._id.toString() === thread_id);
            if (index !== -1) mockThreads.splice(index, 1);
          }
          return res.send('success');
        } else {
          return res.send('incorrect password');
        }
      } catch (err) {
        console.error('Error deleting thread:', err);
        return res.status(500).send('Error deleting thread');
      }
    })

    // Report a thread
    .put(async function (req, res) {
      const { thread_id } = req.body;

      try {
        let thread;
        let useDb = true;

        try {
          // Try using MongoDB
          thread = await Thread.findById(thread_id);
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          thread = mockThreads.find(t => t._id.toString() === thread_id);
          useDb = false;
        }

        if (!thread) return res.send('Thread not found');

        thread.reported = true;

        if (useDb) {
          await thread.save();
        }

        return res.send('reported');
      } catch (err) {
        console.error('Error reporting thread:', err);
        return res.status(500).send('Error reporting thread');
      }
    });

  // Reply routes
  app.route('/api/replies/:board')
    // Create a new reply
    // Create a new reply
    // Create a new reply
    .post(async function (req, res) {
      const { thread_id, text, delete_password } = req.body;
      const board = req.params.board;

      try {
        let thread;
        let useDb = true;

        try {
          // Try using MongoDB
          thread = await Thread.findById(thread_id);
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          thread = mockThreads.find(t => t._id.toString() === thread_id);
          useDb = false;
        }

        if (!thread) return res.send('Thread not found');

        // Create a new reply - don't set _id when using MongoDB (let it auto-generate)
        const newReply = {
          text,
          created_on: new Date(),
          delete_password,
          reported: false
        };

        // Only add _id manually for mock data
        if (!useDb) {
          newReply._id = (mockReplyId++).toString();
        }

        thread.bumped_on = new Date();
        thread.replies.push(newReply);

        if (useDb) {
          await thread.save();
        }

        return res.redirect(`/b/${board}/${thread_id}`);
      } catch (err) {
        console.error('Error creating reply:', err);
        return res.status(500).send('Error creating reply');
      }
    })
    // Get a thread with all replies
    .get(async function (req, res) {
      const { thread_id } = req.query;

      try {
        let thread;

        try {
          // Try using MongoDB
          thread = await Thread.findById(thread_id)
            .select('-reported -delete_password -replies.reported -replies.delete_password')
            .lean();
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          const fullThread = mockThreads.find(t => t._id.toString() === thread_id);
          if (fullThread) {
            // Remove sensitive fields
            const { reported, delete_password, ...rest } = fullThread;
            thread = {
              ...rest,
              replies: fullThread.replies.map(r => {
                const { reported, delete_password, ...reply } = r;
                return reply;
              })
            };
          }
        }

        if (!thread) return res.send('Thread not found');

        return res.json(thread);
      } catch (err) {
        console.error('Error fetching thread:', err);
        return res.status(500).send('Error fetching thread');
      }
    })

    // Delete a reply
    .delete(async function (req, res) {
      const { thread_id, reply_id, delete_password } = req.body;

      try {
        let thread;
        let useDb = true;

        try {
          // Try using MongoDB
          thread = await Thread.findById(thread_id);
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          thread = mockThreads.find(t => t._id.toString() === thread_id);
          useDb = false;
        }

        if (!thread) return res.send('Thread not found');

        let reply;
        if (useDb) {
          reply = thread.replies.id(reply_id);
        } else {
          reply = thread.replies.find(r => r._id.toString() === reply_id);
        }

        if (!reply) return res.send('Reply not found');

        if (reply.delete_password === delete_password) {
          reply.text = '[deleted]';

          if (useDb) {
            await thread.save();
          }

          return res.send('success');
        } else {
          return res.send('incorrect password');
        }
      } catch (err) {
        console.error('Error deleting reply:', err);
        return res.status(500).send('Error deleting reply');
      }
    })

    // Report a reply
    .put(async function (req, res) {
      const { thread_id, reply_id } = req.body;

      try {
        let thread;
        let useDb = true;

        try {
          // Try using MongoDB
          thread = await Thread.findById(thread_id);
        } catch (err) {
          // Fallback to mock if MongoDB fails
          console.error('MongoDB find error, using mock:', err);
          thread = mockThreads.find(t => t._id.toString() === thread_id);
          useDb = false;
        }

        if (!thread) return res.send('Thread not found');

        let reply;
        if (useDb) {
          reply = thread.replies.id(reply_id);
        } else {
          reply = thread.replies.find(r => r._id.toString() === reply_id);
        }

        if (!reply) return res.send('Reply not found');

        reply.reported = true;

        if (useDb) {
          await thread.save();
        }

        return res.send('reported');
      } catch (err) {
        console.error('Error reporting reply:', err);
        return res.status(500).send('Error reporting reply');
      }
    });
};
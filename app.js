const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const BASE_URL = 'https://iris.kasmtestingdevops.in/api/public';

function generateRandomPassword(username) {
  const getRandomSpecialCharacter = () => ['$', '#', '@', '&'][Math.floor(Math.random() * 4)];
  const getRandomCapitalLetter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const getRandomSmallLetter = () => String.fromCharCode(97 + Math.floor(Math.random() * 26));
  const getRandomDigit = () => Math.floor(Math.random() * 10);

  return `${getRandomDigit()}${getRandomCapitalLetter()}${getRandomSmallLetter()}${username}${getRandomDigit()}${getRandomCapitalLetter()}${getRandomSmallLetter()}${getRandomSpecialCharacter()}`;
}

const checkUserExists = async (apiBody) => {
  try {
    const response = await axios.post(`${BASE_URL}/get_user`, apiBody, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
};

const createUser = async (apiBodyForCreateUser) => {
  try {
    const response = await axios.post(`${BASE_URL}/create_user`, apiBodyForCreateUser, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response;
  } catch (error) {
    console.error('Error creating user:', error.response?.data || error.message);
    throw error;
  }
};

const generateSession = async (apiBody, apiBodyForKasm) => {
  try {
    const response = await axios.post(`${BASE_URL}/get_images`, apiBody, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const image = response.data.images.find((image) => image.description === apiBody.descriptionCourse);
    if (image) {
      apiBodyForKasm = {
        ...apiBodyForKasm,
        image_id: image.image_id,
        enable_sharing: false,
        environment: { ENV_VAR: 'value' },
      };

      const kasmResponse = await axios.post(`${BASE_URL}/request_kasm`, apiBodyForKasm, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (kasmResponse) {
        return kasmResponse.data;
      } else {
        console.log('No kasm found!');
      }
    } else {
      console.log('No record found with the given description in get_images response');
    }
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
};

app.post('/get_user', async (req, res) => {
  let url = '';
  const { api_key, api_key_secret, target_user, descriptionCourse, group_id } = req.body;
  if (!target_user.username) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }
 
  try {
    let apiBody = {
      api_key: api_key,
      api_key_secret: api_key_secret,
      target_user: target_user,
    };

    let user = await checkUserExists(apiBody);
    if (!user) {
      let apiBodyForCreateUser = {
        api_key: api_key,
        api_key_secret: api_key_secret,
        target_user: {
          username: target_user.username,
          password: '123@Deepak',
        }
      };
      const createdUser = await createUser(apiBodyForCreateUser);
      const apiBodyForGetUser = {
        api_key: api_key,
        api_key_secret: api_key_secret,
        target_user: {
          username: createdUser.data.user.username
        }
      }
      const userAfterCreate = await checkUserExists(apiBodyForGetUser)
      const isGroupIdPresent = userAfterCreate.data.user.groups.some(group => group.group_id === group_id)
      if(isGroupIdPresent) {
        let apiBodyForImage = {
          ...apiBody,
          descriptionCourse: descriptionCourse,
        };
        let apiBodyForKasm = {
          api_key: api_key,
          api_key_secret: api_key_secret,
          user_id: createdUser.data.user.user_id,
          launch_selections: { username: createdUser.data.user.user_id, password: '123@Deepak' },
        };
        url = await generateSession(apiBodyForImage, apiBodyForKasm);
      }
      else {
        let apiBodyToCreateUserInSentGroup = {
          api_key: api_key,
          api_key_secret: api_key_secret,
          target_user: {
            user_id: userAfterCreate.data.user.user_id
          },
          target_group: {
            group_id: group_id
          }
        }
        const response = await axios.post(`${BASE_URL}/add_user_group`, apiBodyToCreateUserInSentGroup, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if(response.status === 200) {
          let apiBodyForImage = {
            ...apiBody,
            descriptionCourse: descriptionCourse,
          };
          let apiBodyForKasm = {
            api_key: api_key,
            api_key_secret: api_key_secret,
            user_id: userAfterCreate.data.user.user_id,
            launch_selections: { username: userAfterCreate.data.user.user_id, password: userAfterCreate.data.user.crypt_password },
          };
          url = await generateSession(apiBodyForImage, apiBodyForKasm);
        }
      }

    } else {
      const apiBodyForGetKasms = {
        api_key: api_key,
        api_key_secret: api_key_secret
      }
    
      const responseForGetKasms = await axios.post(`${BASE_URL}/get_kasms`, apiBodyForGetKasms, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (responseForGetKasms.data.kasms.length > 0) {
        const userKasm = responseForGetKasms.data.kasms.find(kasm => kasm.user_id === user.data.user.user_id);
        if (userKasm) {
          const kasmUrl = `/#/session/${userKasm.kasm_id}`;
          url = {
            kasm_id: userKasm.kasm_id,
            kasm_url: kasmUrl
          }
        }
      }
      else {
      const isGroupIdPresent = user.data.user.groups.some(group => group.group_id === group_id)
      if(isGroupIdPresent) {
        let apiBodyForImage = {
          ...apiBody,
          descriptionCourse: descriptionCourse,
        };
        let apiBodyForKasm = {
          api_key: api_key,
          api_key_secret: api_key_secret,
          user_id: user.data.user.user_id,
          launch_selections: { username: user.data.user.user_id, password: user.data.user.crypt_password },
        };
        url = await generateSession(apiBodyForImage, apiBodyForKasm);
      }
      else {
        let apiBodyToCreateUserInSentGroup = {
          api_key: api_key,
          api_key_secret: api_key_secret,
          target_user: {
            user_id: user.data.user.user_id
          },
          target_group: {
            group_id: group_id
          }
        }
        const response = await axios.post(`${BASE_URL}/add_user_group`, apiBodyToCreateUserInSentGroup, {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if(response.status === 200) {
          let apiBodyForImage = {
            ...apiBody,
            descriptionCourse: descriptionCourse,
          };
          let apiBodyForKasm = {
            api_key: api_key,
            api_key_secret: api_key_secret,
            user_id: user.data.user.user_id,
            launch_selections: { username: user.data.user.user_id, password: user.data.user.crypt_password },
          };
          url = await generateSession(apiBodyForImage, apiBodyForKasm);
        }
      }
    }
    }

    res.json({ success: true, url: url });
  } catch (error) {
    console.error('Error in get_user API:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = 5500;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
// // module.exports.handler = serverless(app);